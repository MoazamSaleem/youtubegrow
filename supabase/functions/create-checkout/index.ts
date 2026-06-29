import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const PLAN_CATALOG: Record<string, { name: string; monthly: number; yearly: number }> = {
  basic: { name: "Basic", monthly: 7, yearly: 70 },
  pro: { name: "Pro", monthly: 15, yearly: 120 },
  advanced: { name: "Advanced", monthly: 25, yearly: 230 },
};

const priceEnvName = (planKey: string, billingCycle: string) =>
  `STRIPE_${planKey.toUpperCase()}_${billingCycle === "yearly" ? "YEARLY" : "MONTHLY"}_PRICE_ID`;

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
      planKey,
      billingCycle: requestedBillingCycle,
      amountUsd,
      email,
      userId,
    } = payload ?? {};
    const billingCycle = requestedBillingCycle === "yearly" ? "yearly" : "monthly";
    const normalizedPlanKey = typeof planKey === "string" ? planKey.toLowerCase() : "";
    const planConfig = PLAN_CATALOG[normalizedPlanKey];
    if (!planConfig) {
      return new Response(JSON.stringify({ error: "Invalid subscription plan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const expectedAmountUsd = billingCycle === "yearly" ? planConfig.yearly : planConfig.monthly;
    logStep("Checkout payload received", { priceId, productId, planKey: normalizedPlanKey, billingCycle, amountUsd });

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

    let resolvedPriceId = Deno.env.get(priceEnvName(normalizedPlanKey, billingCycle)) || undefined;
    if (resolvedPriceId) {
      try {
        const envPrice = await stripe.prices.retrieve(resolvedPriceId);
        const expectedInterval = billingCycle === "yearly" ? "year" : "month";
        const expectedAmountCents = Math.round(expectedAmountUsd * 100);
        if (
          envPrice.active &&
          envPrice.type === "recurring" &&
          envPrice.recurring?.interval === expectedInterval &&
          envPrice.unit_amount === expectedAmountCents
        ) {
          logStep("Resolved Stripe price by environment", { resolvedPriceId, planKey: normalizedPlanKey, billingCycle });
        } else {
          logStep("Environment Stripe price does not match selected plan; falling back", { resolvedPriceId });
          resolvedPriceId = undefined;
        }
      } catch (error) {
        logStep("Environment Stripe price lookup failed; falling back", {
          resolvedPriceId,
          error: error instanceof Error ? error.message : String(error),
        });
        resolvedPriceId = undefined;
      }
    }

    if (!resolvedPriceId) {
      const lookupInterval = billingCycle === "yearly" ? "year" : "month";
      const lookupKey = `ytgp_${normalizedPlanKey}_${lookupInterval}_${expectedAmountUsd}usd`;
      const lookupSearch = await stripe.prices.search({
        query: `active:'true' AND lookup_key:'${lookupKey}'`,
        limit: 1,
      });
      if (lookupSearch.data.length > 0) {
        resolvedPriceId = lookupSearch.data[0].id;
        logStep("Resolved Stripe price by lookup_key", { resolvedPriceId, lookupKey });
      }

      if (!resolvedPriceId) {
        const lookupList = await stripe.prices.list({
          lookup_keys: [lookupKey],
          active: true,
          limit: 1,
        });
        if (lookupList.data.length > 0) {
          resolvedPriceId = lookupList.data[0].id;
          logStep("Resolved Stripe price by lookup_keys list", { resolvedPriceId, lookupKey });
        }
      }

      if (!resolvedPriceId && productId) {
        const expectedInterval = billingCycle === "yearly" ? "year" : "month";
        try {
          const prices = await stripe.prices.list({
            product: productId,
            active: true,
            limit: 100,
          });

          const recurringPrices = prices.data.filter(
            (price) =>
              price.type === "recurring" &&
              price.recurring?.interval === expectedInterval &&
              price.unit_amount === Math.round(expectedAmountUsd * 100)
          );

          if (recurringPrices.length > 0) {
            resolvedPriceId = recurringPrices[0].id;
            logStep("Resolved Stripe price by product", { resolvedPriceId, billingCycle, productId });
          }
        } catch (error) {
          logStep("Client product lookup failed; will use server-side live price fallback", {
            productId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!resolvedPriceId) {
        const product = await stripe.products.create({
          name: `YT Growth Pro ${planConfig.name}`,
          metadata: { plan_key: normalizedPlanKey },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(expectedAmountUsd * 100),
          currency: "usd",
          recurring: { interval: lookupInterval },
          lookup_key: lookupKey,
          metadata: {
            plan_key: normalizedPlanKey,
            billing_cycle: billingCycle,
          },
        });
        resolvedPriceId = price.id;
        logStep("Created live Stripe product/price fallback", {
          productId: product.id,
          resolvedPriceId,
          lookupKey,
          planKey: normalizedPlanKey,
          billingCycle,
        });
      }
    }

    if (!resolvedPriceId) {
      throw new Error("Unable to resolve Stripe price for selected plan");
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
    const origin =
      req.headers.get("origin") ||
      Deno.env.get("SITE_URL") ||
      "https://ytgrowth.cloud";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : resolvedEmail,
      client_reference_id: resolvedUserId,
      payment_method_types: ["card"],
      metadata: resolvedUserId
        ? { supabase_user_id: resolvedUserId, billing_cycle: billingCycle, plan_key: normalizedPlanKey }
        : { billing_cycle: billingCycle, plan_key: normalizedPlanKey },
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
    });
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stripeError = error as { type?: string; code?: string; message?: string };
    logStep("ERROR", {
      message: errorMessage,
      type: stripeError?.type ?? null,
      code: stripeError?.code ?? null,
    });

    const normalized = (errorMessage || "").toLowerCase();
    const status =
      normalized.includes("no such price") ||
      normalized.includes("no such product") ||
      stripeError?.type === "StripeInvalidRequestError"
        ? 400
        : 500;

    return new Response(JSON.stringify({
      error: errorMessage,
      type: stripeError?.type ?? null,
      code: stripeError?.code ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
