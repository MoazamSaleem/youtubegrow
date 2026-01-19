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
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Supabase URL/anon key not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  try {
    logStep("Function started");
    
    const payload = await req.json();
    const { priceId, email, userId } = payload ?? {};
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId });

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
    
    const customers = await stripe.customers.list({ email: resolvedEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const successPath = typeof payload?.successPath === "string" ? payload.successPath : "/dashboard?checkout=success";
    const cancelPath = typeof payload?.cancelPath === "string" ? payload.cancelPath : "/dashboard/billing?checkout=cancelled";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : resolvedEmail,
      client_reference_id: resolvedUserId,
      metadata: resolvedUserId ? { supabase_user_id: resolvedUserId } : undefined,
      line_items: [{ price: priceId, quantity: 1 }],
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
