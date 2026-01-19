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
  free: 100, // Small amount for free trial
  basic: 1000,
  pro: 10000,
  advanced: 25000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_URL is not set" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header provided" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const userClientKey = anonKey || serviceRoleKey;
  if (!userClientKey) {
    return new Response(JSON.stringify({ error: "Supabase key is not set" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const userClient = createClient(
    supabaseUrl,
    userClientKey,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    }
  );
  const adminClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError) {
      return new Response(JSON.stringify({ error: `Authentication error: ${userError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get current subscription from database to check for plan changes
    const { data: currentSubData } = await userClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (!stripeKey) {
      logStep("Stripe key not set, returning current subscription");
      const fallbackPlan = currentSubData?.plan || "free";
      const fallbackStatus = currentSubData?.status || "inactive";
      return new Response(JSON.stringify({
        subscribed: fallbackStatus === "active" || fallbackStatus === "trialing",
        product_id: null,
        plan: fallbackPlan,
        subscription_end: currentSubData?.current_period_end ?? null,
        has_used_free_trial: currentSubData?.has_used_free_trial || false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!adminClient) {
      logStep("Service role key not set, returning current subscription");
      const fallbackPlan = currentSubData?.plan || "free";
      const fallbackStatus = currentSubData?.status || "inactive";
      return new Response(JSON.stringify({
        subscribed: fallbackStatus === "active" || fallbackStatus === "trialing",
        product_id: null,
        plan: fallbackPlan,
        subscription_end: currentSubData?.current_period_end ?? null,
        has_used_free_trial: currentSubData?.has_used_free_trial || false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseAdmin = adminClient;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    const previousPlan = currentSubData?.plan || "free";
    const previousStatus = currentSubData?.status || null;
    logStep("Current subscription data", { previousPlan, previousStatus });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      
      // If they have pending status, it means payment failed or was cancelled
      if (previousStatus === "pending") {
        // Reset to free plan
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan: "free",
            status: "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        plan: currentSubData?.plan || "free",
        has_used_free_trial: currentSubData?.has_used_free_trial || false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });
    
    const activeSubscription = subscriptions.data.find((sub: { status: string }) => sub.status === "active" || sub.status === "trialing") ?? null;
    const hasActiveSub = !!activeSubscription;
    let productId = null;
    let plan = previousPlan;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = activeSubscription!;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      const priceId = subscription.items.data[0].price.id;
      
      // Map product IDs to plans
      const productPlanMap: Record<string, string> = {
        "prod_TjlB0qtrN0s4u6": "basic",
        "prod_TjlBgvbmpocKMF": "pro",
        "prod_TjlCT4ijKq11hk": "advanced",
      };
      const pricePlanMap: Record<string, string> = {
        "price_1SmHf4IvqpEim8WgtxTKqyp0": "basic",
        "price_1SmHfXIvqpEim8Wg9JtMKO3J": "pro",
        "price_1SmHfeIvqpEim8WgyUq2VpbB": "advanced",
      };
      plan = productPlanMap[productId] || pricePlanMap[priceId] || "free";
      logStep("Active subscription found", { plan, subscriptionEnd, previousPlan, previousStatus });

      // Check if this is a new subscription or plan upgrade (status was pending or plan changed)
      const isNewSubscription = previousStatus === "pending" || previousStatus === "trialing";
      const isPlanUpgrade = previousPlan !== plan;

      if (isNewSubscription || isPlanUpgrade) {
        logStep("New subscription or plan change detected", { isNewSubscription, isPlanUpgrade, from: previousPlan, to: plan });
        
        // Update subscription in database
        const { error: upsertError } = await supabaseAdmin
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
        logStep("Adding AI credits", { plan, creditsToAdd });
        
        if (creditsToAdd > 0) {
          // Get current credits
          const { data: tokenData, error: tokenFetchError } = await supabaseAdmin
            .from("user_tokens")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          logStep("Current token data", { tokenData, tokenFetchError });

          if (tokenData) {
            // Update existing record
            const currentCredits = tokenData.ai_credits_balance || 0;
            const newCredits = currentCredits + creditsToAdd;

            const { error: creditError } = await supabaseAdmin
              .from("user_tokens")
              .update({
                ai_credits_balance: newCredits,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id);

            if (creditError) {
              logStep("Error updating credits", { error: creditError.message });
            } else {
              logStep("Credits updated successfully", { creditsAdded: creditsToAdd, newBalance: newCredits });
              
              // Log to credits history
              await supabaseAdmin.from("credits_history").insert({
                user_id: user.id,
                amount: creditsToAdd,
                type: "subscription",
                description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan subscription`,
                balance_after: newCredits,
              });
            }
          } else {
            // Insert new record
            const { error: creditError } = await supabaseAdmin
              .from("user_tokens")
              .insert({
                user_id: user.id,
                ai_credits_balance: creditsToAdd,
                balance: 0,
                total_earned: 0,
                total_spent: 0,
                current_xp: 0,
                ai_credits_used: 0,
              });

            if (creditError) {
              logStep("Error inserting credits", { error: creditError.message });
            } else {
              logStep("Credits inserted successfully", { creditsAdded: creditsToAdd });
              
              // Log to credits history
              await supabaseAdmin.from("credits_history").insert({
                user_id: user.id,
                amount: creditsToAdd,
                type: "subscription",
                description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan subscription`,
                balance_after: creditsToAdd,
              });
            }
          }
        }
      } else {
        // Plan unchanged, just update subscription status if needed
        if (currentSubData?.status !== "active") {
          const { error: updateError } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_end: subscriptionEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

          if (updateError) {
            logStep("Error updating subscription status", { error: updateError.message });
          }
        }
      }
    } else {
      logStep("No active Stripe subscription found");
      
      // If user had a pending paid plan, it failed - revert to free
      if (previousStatus === "pending") {
        logStep("Reverting pending subscription to free");
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan: "free",
            status: "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        plan = "free";
      }
      
      // If user had a paid plan but no longer has active subscription, downgrade to free
      if (previousPlan !== "free" && previousStatus === "active") {
        logStep("Downgrading to free plan", { from: previousPlan });
        
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan: "free",
            status: "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        plan = "free";
      }
    }

    // Get updated has_used_free_trial status
    const { data: finalSubData } = await supabaseAdmin
      .from("subscriptions")
      .select("has_used_free_trial")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      plan,
      subscription_end: subscriptionEnd,
      has_used_free_trial: finalSubData?.has_used_free_trial || false
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
