import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Supabase URL/anon key not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
    : null;

  try {
    logStep("Function started");
    
    const payload = await req.json();
    const {
      priceId,
      productId,
      billingCycle: requestedBillingCycle,
      amountUsd,
      email,
      userId,
    } = payload ?? {};
    const billingCycle = requestedBillingCycle === "yearly" ? "yearly" : "monthly";
    logStep("Checkout payload received", { priceId, productId, billingCycle, amountUsd });

    const authHeader = req.headers.get("Authorization");
    let resolvedEmail = email as string | undefined;
    let resolvedUserId = userId as string | undefined;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && data.user) {
        resolvedEmail = data.user.email ?? resolvedEmail;
        resolvedUserId = data.user.id ?? resolvedUserId;
        logStep("User authenticated", { email: resolvedEmail });
      } else if (!resolvedEmail) {
        return new Response(JSON.stringify({ error: `Authentication failed: ${authError?.message || "Unauthorized"}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    }

    if (!resolvedEmail) {
      return new Response(JSON.stringify({ error: "Missing user email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY is not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    let resolvedPriceId = priceId as string | undefined;
    if (!resolvedPriceId) {
      if (!productId) {
        throw new Error("Product ID is required when price ID is not provided");
      }

      const expectedInterval = billingCycle === "yearly" ? "year" : "month";
      const expectedAmountCents =
        typeof amountUsd === "number" && Number.isFinite(amountUsd)
          ? Math.round(amountUsd * 100)
          : null;

      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 100,
      });

      const recurringPrices = prices.data.filter(
        (price) =>
          price.type === "recurring" &&
          price.recurring?.interval === expectedInterval &&
          (expectedAmountCents === null || price.unit_amount === expectedAmountCents)
      );

      if (recurringPrices.length === 0) {
        throw new Error(`No active ${billingCycle} Stripe price found for product ${productId}`);
      }

      resolvedPriceId = recurringPrices[0].id;
      logStep("Resolved Stripe price", { resolvedPriceId, billingCycle, productId });
    }
    
    let customerId: string | undefined;

    if (resolvedUserId && supabaseAdmin) {
      const { data: storedCustomerId } = await supabaseAdmin.rpc("get_stripe_customer_id", {
        p_user_id: resolvedUserId,
      });

      if (storedCustomerId) {
        try {
          const storedCustomer = await stripe.customers.retrieve(storedCustomerId);
          if (!("deleted" in storedCustomer) || !storedCustomer.deleted) {
            customerId = storedCustomer.id;
            logStep("Resolved Stripe customer from secure storage", { customerId });
          }
        } catch (error) {
          logStep("Stored customer lookup failed, falling back to email", {
            userId: resolvedUserId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (!customerId) {
      const customers = await stripe.customers.list({ email: resolvedEmail, limit: 10 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found", { customerId });
      }
    }

    if (customerId && resolvedUserId && supabaseAdmin) {
      await supabaseAdmin.rpc("upsert_stripe_data", {
        p_user_id: resolvedUserId,
        p_stripe_customer_id: customerId,
      });
    }

    if (customerId) {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
      });

      const activeSubscriptions = existingSubscriptions.data.filter(
        (subscription) => subscription.status === "active" || subscription.status === "trialing"
      );

      if (activeSubscriptions.length > 0) {
        const origin = req.headers.get("origin") || "http://localhost:3000";
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/dashboard/billing?portal=1`,
        });

        logStep("Existing active subscription found, redirecting to portal", {
          customerId,
          activeSubscriptionCount: activeSubscriptions.length,
        });

        return new Response(JSON.stringify({
          url: portalSession.url,
          mode: "portal",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const successPath = typeof payload?.successPath === "string" ? payload.successPath : "/payment-success";
    const cancelPath = typeof payload?.cancelPath === "string" ? payload.cancelPath : "/dashboard/billing?checkout=cancelled";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : resolvedEmail,
      client_reference_id: resolvedUserId,
      metadata: resolvedUserId
        ? { supabase_user_id: resolvedUserId, billing_cycle: billingCycle }
        : { billing_cycle: billingCycle },
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}${successPath}`,
      cancel_url: `${req.headers.get("origin")}${cancelPath}`,
    });
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    const status = errorMessage.toLowerCase().includes("no such price") ? 400 : 500;
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
