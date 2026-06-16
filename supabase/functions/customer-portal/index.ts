import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    let customerId: string | null = null;
    const { data: storedCustomerId } = await supabaseClient.rpc("get_stripe_customer_id", {
      p_user_id: user.id,
    });

    if (storedCustomerId) {
      try {
        const storedCustomer = await stripe.customers.retrieve(storedCustomerId);
        if (!("deleted" in storedCustomer) || !storedCustomer.deleted) {
          customerId = storedCustomer.id;
          logStep("Resolved Stripe customer from secure storage", { customerId });
        }
      } catch (error) {
        logStep("Stored Stripe customer lookup failed, falling back to email", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      customerId = customers.data[0]?.id ?? null;
    }

    if (!customerId) {
      throw new Error("No Stripe customer found for this user");
    }

    logStep("Found Stripe customer", { customerId });

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/billing?portal=1`,
    });
    logStep("Portal session created", { url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
