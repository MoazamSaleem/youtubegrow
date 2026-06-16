import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { selectBestSubscriptionRecord } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const isFutureDate = (value?: string | null) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const isDbSubscriptionActive = (subscription?: {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
} | null) => {
  if (!subscription) return false;

  switch (subscription.status) {
    case "active":
    case "trialing":
      return true;
    case "cancelled":
    case "canceled":
      return isFutureDate(subscription.trial_ends_at || subscription.current_period_end);
    default:
      return false;
  }
};

const hasSubscriptionWindowEnded = (subscription?: {
  current_period_end?: string | null;
  trial_ends_at?: string | null;
} | null) => {
  if (!subscription) return true;
  return !isFutureDate(subscription.trial_ends_at || subscription.current_period_end);
};

// AI Credits included with each plan
const PLAN_AI_CREDITS: Record<string, number> = {
  basic: 1000,
  pro: 10000,
  advanced: 25000,
};

const persistSubscriptionRecord = async ({
  supabaseAdmin,
  userId,
  values,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  values: Record<string, unknown>;
}) => {
  const payload = {
    ...values,
    updated_at: values.updated_at ?? new Date().toISOString(),
  };

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("subscriptions")
    .update(payload)
    .eq("user_id", userId)
    .select("id");

  if (updateError) {
    return { error: updateError };
  }

  if (updatedRows && updatedRows.length > 0) {
    return { error: null };
  }

  const { error: insertError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      ...payload,
    });

  return { error: insertError ?? null };
};

const PLAN_RANK: Record<string, number> = {
  basic: 0,
  pro: 1,
  advanced: 2,
};

const getPlanRank = (plan?: string | null) => {
  if (!plan) return -1;
  return PLAN_RANK[plan] ?? -1;
};

const resolvePlanFromStripeSubscription = (
  subscription: Stripe.Subscription,
  previousPlan: string | null
) => {
  const firstItem = subscription.items.data[0];
  const productId = firstItem?.price?.product as string;
  const priceId = firstItem?.price?.id;
  const priceLookupKey = firstItem?.price?.lookup_key ?? "";
  const productObj =
    typeof firstItem?.price?.product === "object" && firstItem?.price?.product
      ? (firstItem.price.product as Stripe.Product)
      : null;
  const productName = productObj?.name?.toLowerCase?.() ?? "";

  const normalizePlan = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized === "basic" || normalized === "pro" || normalized === "advanced") return normalized;
    return null;
  };

  const planFromLookupKey = (() => {
    if (!priceLookupKey) return null;
    if (priceLookupKey.startsWith("ytgp_basic_")) return "basic";
    if (priceLookupKey.startsWith("ytgp_pro_")) return "pro";
    if (priceLookupKey.startsWith("ytgp_advanced_")) return "advanced";
    return null;
  })();

  if (planFromLookupKey) return planFromLookupKey;

  if (productName.includes("basic")) return "basic";
  if (productName.includes("pro")) return "pro";
  if (productName.includes("advanced")) return "advanced";

  const productPlanMap: Record<string, string> = {
    "prod_ULG0alM0SRcCvv": "basic",
    "prod_ULG2MM6wkJhMnk": "basic",
    "prod_ULG1B0SlaVlpYA": "pro",
    "prod_ULG2hmVTfKbRSK": "pro",
    "prod_ULG1utqbngUXMt": "advanced",
    "prod_ULG366uyBVF8U9": "advanced",
  };
  const pricePlanMap: Record<string, string> = {
    "price_1TMZUeB55nrd5jvIp7DcB0bK": "basic",
    "price_1TMZWGB55nrd5jvI1n7dVzL9": "basic",
    "price_1TMZVAB55nrd5jvIHhgZEUMT": "pro",
    "price_1TMZWjB55nrd5jvIqiHbYbQs": "pro",
    "price_1TMZVbB55nrd5jvIWcZAj3UI": "advanced",
    "price_1TMZXCB55nrd5jvIkdf5Z6gR": "advanced",
  };

  return normalizePlan(productPlanMap[productId] || pricePlanMap[priceId] || previousPlan);
};

const pickPreferredStripeSubscription = (
  subscriptions: Stripe.Subscription[],
  previousPlan: string | null
) => {
  const activeSubscriptions = subscriptions
    .filter((subscription) => subscription.status === "active" || subscription.status === "trialing")
    .sort((left, right) => {
      const createdDiff = right.created - left.created;
      if (createdDiff !== 0) return createdDiff;

      const statusDiff =
        (right.status === "active" ? 1 : 0) - (left.status === "active" ? 1 : 0);
      if (statusDiff !== 0) return statusDiff;

      const planDiff =
        getPlanRank(resolvePlanFromStripeSubscription(right, previousPlan)) -
        getPlanRank(resolvePlanFromStripeSubscription(left, previousPlan));
      if (planDiff !== 0) return planDiff;

      return right.current_period_end - left.current_period_end;
    });

  return {
    activeSubscriptions,
    preferredSubscription: activeSubscriptions[0] ?? null,
  };
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
    const { data: currentSubRows } = await userClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    const currentSubData = selectBestSubscriptionRecord(currentSubRows ?? []);
    
    if (!stripeKey) {
      logStep("Stripe key not set, returning current subscription");
      const fallbackPlan = currentSubData?.plan || null;
      return new Response(JSON.stringify({
        subscribed: isDbSubscriptionActive(currentSubData),
        product_id: null,
        plan: fallbackPlan,
        subscription_end: currentSubData?.current_period_end ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!adminClient) {
      logStep("Service role key not set, returning current subscription");
      const fallbackPlan = currentSubData?.plan || null;
      return new Response(JSON.stringify({
        subscribed: isDbSubscriptionActive(currentSubData),
        product_id: null,
        plan: fallbackPlan,
        subscription_end: currentSubData?.current_period_end ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseAdmin = adminClient;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    let customerId: string | null = null;

    const { data: storedCustomerId } = await supabaseAdmin.rpc("get_stripe_customer_id", {
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
      if (customerId) {
        await supabaseAdmin.rpc("upsert_stripe_data", {
          p_user_id: user.id,
          p_stripe_customer_id: customerId,
        });
      }
    }
    
    const previousPlan = currentSubData?.plan || null;
    const previousStatus = currentSubData?.status || null;
    const previousBillingCycle = currentSubData?.billing_cycle ?? "monthly";
    const previousSubscriptionEnd = currentSubData?.current_period_end ?? null;
    logStep("Current subscription data", { previousPlan, previousStatus });

    if (!customerId) {
      logStep("No Stripe customer found");
      let plan = currentSubData?.plan || null;
      let status = currentSubData?.status ?? null;
      let subscriptionEnd = previousSubscriptionEnd;
      let billingCycle = previousBillingCycle;
      let subscribed = isDbSubscriptionActive(currentSubData);
      
      // If they have pending status, it means payment failed or was cancelled
      if (previousStatus === "pending" && previousPlan) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "inactive",
            billing_cycle: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date().toISOString(),
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        plan = previousPlan;
        status = "inactive";
        subscriptionEnd = new Date().toISOString();
        billingCycle = "monthly";
        subscribed = false;
      }
      
      return new Response(JSON.stringify({ 
        subscribed,
        product_id: null,
        plan,
        subscription_end: subscriptionEnd,
        status,
        billing_cycle: billingCycle,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
      expand: ["data.items.data.price.product"],
    });

    const { activeSubscriptions, preferredSubscription: activeSubscription } =
      pickPreferredStripeSubscription(subscriptions.data, previousPlan);
    const hasActiveSub = !!activeSubscription;
    let productId = null;
    let plan = previousPlan;
    let subscriptionEnd = previousSubscriptionEnd;
    let resolvedStatus = previousStatus;
    let resolvedBillingCycle = previousBillingCycle;
    let subscribed = isDbSubscriptionActive(currentSubData);

    if (activeSubscriptions.length > 1) {
      logStep("Multiple active Stripe subscriptions detected", {
        customerId,
        count: activeSubscriptions.length,
        subscriptions: activeSubscriptions.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          created: subscription.created,
          current_period_end: subscription.current_period_end,
          plan: resolvePlanFromStripeSubscription(subscription, previousPlan),
        })),
        selectedSubscriptionId: activeSubscription?.id ?? null,
      });
    }

    if (hasActiveSub) {
      const subscription = activeSubscription!;
      const stripeStatus = subscription.status === "trialing" ? "trialing" : "active";
      const billingCycle = subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly";
      const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      plan = resolvePlanFromStripeSubscription(subscription, previousPlan);
      resolvedStatus = stripeStatus;
      resolvedBillingCycle = billingCycle;
      subscribed = true;
      logStep("Active subscription found", { plan, subscriptionEnd, previousPlan, previousStatus });

      // Check if this is a new subscription or plan upgrade (status was pending or plan changed)
      const isNewSubscription = previousStatus === "pending" || previousStatus === "trialing";
      const isPlanUpgrade = previousPlan !== plan;
      const billingCycleChanged = currentSubData?.billing_cycle !== billingCycle;

      if (isNewSubscription || isPlanUpgrade) {
        logStep("New subscription or plan change detected", { isNewSubscription, isPlanUpgrade, from: previousPlan, to: plan });
        
        // Update subscription in database (without sensitive Stripe IDs)
        const { error: upsertError } = await persistSubscriptionRecord({
          supabaseAdmin,
          userId: user.id,
          values: {
            plan: plan,
            status: stripeStatus,
            current_period_end: subscriptionEnd,
            current_period_start: currentPeriodStart,
            billing_cycle: billingCycle,
            trial_ends_at: stripeStatus === "trialing" ? subscriptionEnd : null,
          },
        });

        // Store Stripe IDs in secure table using helper function
        await supabaseAdmin.rpc('upsert_stripe_data', {
          p_user_id: user.id,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscription.id
        });

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
        // Plan unchanged, keep status, billing cycle, and period boundaries synced.
        if (
          currentSubData?.status !== stripeStatus ||
          currentSubData?.current_period_end !== subscriptionEnd ||
          currentSubData?.current_period_start !== currentPeriodStart ||
          billingCycleChanged ||
          (stripeStatus === "trialing" && currentSubData?.trial_ends_at !== subscriptionEnd) ||
          (stripeStatus !== "trialing" && currentSubData?.trial_ends_at)
        ) {
          const { error: updateError } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: stripeStatus,
              current_period_end: subscriptionEnd,
              current_period_start: currentPeriodStart,
              billing_cycle: billingCycle,
              trial_ends_at: stripeStatus === "trialing" ? subscriptionEnd : null,
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
      
      if (previousStatus === "pending" && previousPlan) {
        logStep("Marking pending subscription inactive", { plan: previousPlan });
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "inactive",
            billing_cycle: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date().toISOString(),
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        plan = previousPlan;
        resolvedStatus = "inactive";
        resolvedBillingCycle = "monthly";
        subscriptionEnd = new Date().toISOString();
        subscribed = false;
      }
      
      if (
        previousPlan &&
        (previousStatus === "active" ||
          previousStatus === "trialing" ||
          previousStatus === "cancelled" ||
          previousStatus === "canceled") &&
        hasSubscriptionWindowEnded(currentSubData)
      ) {
        logStep("Marking expired subscription inactive", { from: previousPlan });
        
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "inactive",
            billing_cycle: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date().toISOString(),
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        plan = previousPlan;
        resolvedStatus = "inactive";
        resolvedBillingCycle = "monthly";
        subscriptionEnd = new Date().toISOString();
        subscribed = false;
      }
    }

    return new Response(JSON.stringify({
      subscribed,
      product_id: productId,
      plan,
      subscription_end: subscriptionEnd,
      status: resolvedStatus,
      billing_cycle: resolvedBillingCycle,
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
