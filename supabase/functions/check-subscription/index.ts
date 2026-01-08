import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// AI Credits included with each plan
const PLAN_AI_CREDITS: Record<string, number> = {
  free: 0,
  basic: 1000,
  pro: 10000,
  advanced: 25000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let plan = "free";
    let subscriptionEnd = null;

    // Get current subscription from database to check for plan changes
    const { data: currentSubData } = await supabaseClient
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    
    const previousPlan = currentSubData?.plan || "free";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      
      // Map product IDs to plans
      const productPlanMap: Record<string, string> = {
        "prod_TjlB0qtrN0s4u6": "basic",
        "prod_TjlBgvbmpocKMF": "pro",
        "prod_TjlCT4ijKq11hk": "advanced",
      };
      plan = productPlanMap[productId] || "free";
      logStep("Active subscription found", { plan, subscriptionEnd, previousPlan });

      // Check if plan has changed (upgrade or new subscription)
      if (previousPlan !== plan) {
        logStep("Plan changed, updating subscription and adding credits", { from: previousPlan, to: plan });
        
        // Update subscription in database
        const { error: upsertError } = await supabaseClient
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            plan: plan,
            status: "active",
            current_period_end: subscriptionEnd,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            billing_cycle: subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (upsertError) {
          logStep("Error updating subscription", { error: upsertError.message });
        } else {
          logStep("Subscription updated successfully");
        }

        // Add AI credits for the new plan
        const creditsToAdd = PLAN_AI_CREDITS[plan] || 0;
        if (creditsToAdd > 0) {
          // Get current credits
          const { data: tokenData } = await supabaseClient
            .from("user_tokens")
            .select("ai_credits_balance")
            .eq("user_id", user.id)
            .maybeSingle();

          const currentCredits = tokenData?.ai_credits_balance || 0;
          const newCredits = currentCredits + creditsToAdd;

          // Update or insert credits
          const { error: creditError } = await supabaseClient
            .from("user_tokens")
            .upsert({
              user_id: user.id,
              ai_credits_balance: newCredits,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          if (creditError) {
            logStep("Error adding credits", { error: creditError.message });
          } else {
            logStep("Credits added successfully", { creditsAdded: creditsToAdd, newBalance: newCredits });
          }
        }
      } else {
        // Plan unchanged, just update subscription status
        const { error: updateError } = await supabaseClient
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            plan: plan,
            status: "active",
            current_period_end: subscriptionEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (updateError) {
          logStep("Error updating subscription", { error: updateError.message });
        }
      }
    } else {
      logStep("No active subscription found");
      
      // If user had a paid plan but no longer has active subscription, downgrade to free
      if (previousPlan !== "free") {
        logStep("Downgrading to free plan", { from: previousPlan });
        
        await supabaseClient
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            plan: "free",
            status: "inactive",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      plan,
      subscription_end: subscriptionEnd
    }), {
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
