import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PLAN_LIMITS, SubscriptionPlan, getPlanDisplayName } from "@/lib/planLimits";
import { STRIPE_PLANS } from "@/lib/stripeConfig";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Check,
  X,
  Crown,
  Zap,
  Star,
  Rocket,
  Loader2,
  Settings,
  Sparkles,
} from "lucide-react";

const Billing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, loading, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const currentPlan = subscription?.plan || "free";
  const currentBillingCycle = subscription?.billing_cycle === "yearly" ? "yearly" : "monthly";
  const selectedBillingCycle = isYearly ? "yearly" : "monthly";

  useEffect(() => {
    if (subscription?.billing_cycle === "yearly") {
      setIsYearly(true);
    }
  }, [subscription?.billing_cycle]);

  // Handle checkout success/cancel
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast({
        title: "Subscription successful!",
        description: "Your subscription has been activated. Refreshing...",
      });
      refreshSubscription();
    } else if (checkout === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "Your subscription was not changed.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, refreshSubscription]);

  const getSessionWithRefresh = async (forceRefresh = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!forceRefresh && !shouldRefresh) return session;
    }

    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session;

    return session ?? null;
  };

  const plans: { key: SubscriptionPlan; icon: React.ElementType; color: string; description: string; cta: string; popular?: boolean }[] = [
    { key: "free", icon: Star, color: "from-slate-500 to-slate-600", description: "1 month trial", cta: "Start Free Trial" },
    { key: "basic", icon: Zap, color: "from-teal-500 to-teal-600", description: "For growing creators", cta: "Get Started" },
    { key: "pro", icon: Crown, color: "from-teal-500 to-cyan-500", description: "Most popular choice", cta: "Get Pro", popular: true },
    { key: "advanced", icon: Rocket, color: "from-amber-500 to-orange-500", description: "For serious creators", cta: "Go Advanced" },
  ];

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    if (plan !== "free") {
      return STRIPE_PLANS[plan].features.map((text) => ({ text, included: true }));
    }

    const limits = PLAN_LIMITS[plan];
    const features: { text: string; included: boolean }[] = [];
    
    features.push({ text: limits.maxChannels === 1 ? "Link 1 channel" : `Link up to ${limits.maxChannels} channels`, included: true });
    features.push({ text: limits.hasAdvancedAnalytics ? "Advanced analytics" : "View basic analytics", included: true });
    features.push({ text: limits.keywordsPerDay === -1 ? "Unlimited keywords" : `${limits.keywordsPerDay} keywords/day`, included: true });
    features.push({ text: `${limits.topicsPerDay} topic suggestions/day`, included: true });
    features.push({ text: limits.channelAnalysisFrequency === "never" ? "AI channel analysis" : limits.channelAnalysisFrequency === "unlimited" ? "Unlimited AI analysis" : `AI analysis ${limits.channelAnalysisFrequency}`, included: limits.channelAnalysisFrequency !== "never" });
    features.push({ text: limits.competitorAnalysisFrequency === "never" ? "Competitor analysis" : limits.competitorAnalysisFrequency === "daily" ? "Daily competitor analysis" : `Competitor analysis ${limits.competitorAnalysisFrequency}`, included: limits.competitorAnalysisFrequency !== "never" });
    features.push({ text: "Script writer", included: limits.hasScriptWriter });
    features.push({ text: limits.thumbnailsPerDay === -1 ? "Unlimited thumbnails" : limits.thumbnailsPerDay > 0 ? `${limits.thumbnailsPerDay} thumbnails/day` : "Thumbnail generator", included: limits.thumbnailsPerDay !== 0 });

    return features;
  };

  const features = [
    { name: "Channels", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].maxChannels },
    { name: "Keywords/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].keywordsPerDay === -1 ? "Unlimited" : PLAN_LIMITS[p].keywordsPerDay },
    { name: "Topics/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].topicsPerDay },
    { name: "AI Credits", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].aiStrategistCredits === 0 ? "None" : PLAN_LIMITS[p].aiStrategistCredits.toLocaleString() },
    { name: "Channel Analysis", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].channelAnalysisFrequency === "never" ? false : PLAN_LIMITS[p].channelAnalysisFrequency },
    { name: "Competitor Analysis", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].competitorAnalysisFrequency === "never" ? false : PLAN_LIMITS[p].competitorAnalysisFrequency },
    { name: "Script Writer", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasScriptWriter },
    { name: "Thumbnails/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].thumbnailsPerDay === -1 ? "Unlimited" : PLAN_LIMITS[p].thumbnailsPerDay || "None" },
    { name: "YouTube Strategist AI", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasYoutubeStrategist },
    { name: "Growth Tasks", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].growthTasksTier === "none" ? false : true },
  ];

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    const isSamePlan = plan === currentPlan;
    const isSameSelection =
      plan === "free"
        ? isSamePlan
        : isSamePlan && currentBillingCycle === selectedBillingCycle;

    if (isSameSelection) return;
    
    // Free plan changes must go through Stripe so the external subscription is cancelled correctly.
    if (plan === "free") {
      if (currentPlan !== "free") {
        toast({
          title: "Manage cancellation in Stripe",
          description: "Use the customer portal to cancel or downgrade your paid subscription safely.",
        });
        await handleManageSubscription();
      }
      return;
    }

    const stripePlan = STRIPE_PLANS[plan as keyof typeof STRIPE_PLANS];
    if (!stripePlan) return;

    setUpgradingPlan(plan);
    try {
      const session = await getSessionWithRefresh();
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: selectedBillingCycle === "monthly" ? stripePlan.monthlyPriceId : undefined,
          productId: stripePlan.productId,
          billingCycle: selectedBillingCycle,
          amountUsd: selectedBillingCycle === "yearly" ? stripePlan.yearlyPrice : stripePlan.monthlyPrice,
        },
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            }
          : undefined,
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: error.message || "Unable to start checkout",
        variant: "destructive",
      });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const session = await getSessionWithRefresh();
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            }
          : undefined,
      });
      
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Unable to open portal",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  const getPrice = (plan: SubscriptionPlan) => {
    if (plan === "free") return 0;
    return isYearly ? STRIPE_PLANS[plan].yearlyPrice : STRIPE_PLANS[plan].monthlyPrice;
  };

  const getSavings = (plan: SubscriptionPlan) => {
    if (plan === "free") return 0;
    const monthly = STRIPE_PLANS[plan].monthlyPrice;
    const yearly = STRIPE_PLANS[plan].yearlyPrice;
    const yearlyEquivalent = monthly * 12;
    return yearlyEquivalent - yearly;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                <CreditCard className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Billing & Plans
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect plan for your YouTube growth journey. Upgrade or downgrade anytime.
            </p>

            {/* Current Plan Info & Manage Button */}
            {currentPlan !== "free" && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {getPlanDisplayName(currentPlan)} Plan Active
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                >
                  {managingSubscription ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              </div>
            )}

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <span className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                Monthly
              </span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <span className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                Yearly
              </span>
              {isYearly && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  Save up to 23%
                </Badge>
              )}
            </div>
          </motion.div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {plans.map((plan, index) => {
              const isCurrentPlan =
                plan.key === "free"
                  ? currentPlan === "free"
                  : currentPlan === plan.key && currentBillingCycle === selectedBillingCycle;
              const isSamePlanDifferentCycle =
                plan.key !== "free" &&
                currentPlan === plan.key &&
                currentBillingCycle !== selectedBillingCycle;
              const price = getPrice(plan.key);
              const savings = getSavings(plan.key);

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={`glass rounded-xl p-6 relative ${
                    plan.popular ? "ring-2 ring-primary" : ""
                  } ${isCurrentPlan ? "bg-primary/5" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}

                  {isCurrentPlan && (
                    <Badge className="absolute -top-3 right-4 bg-green-500 text-white">
                      Current Plan
                    </Badge>
                  )}

                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                    <plan.icon className="h-6 w-6 text-white" />
                  </div>

                  <h3 className="font-display text-xl font-bold mb-1">
                    {getPlanDisplayName(plan.key)}
                  </h3>

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">${price}</span>
                    <span className="text-muted-foreground">
                      /{isYearly ? "year" : "month"}
                    </span>
                  </div>

                  {isYearly && savings > 0 && (
                    <p className="text-sm text-green-500 mb-4">
                      Save ${savings}/year
                    </p>
                  )}

                  <ul className="space-y-2 mb-6">
                    {getPlanFeatures(plan.key).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2 text-sm">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground/50"}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrentPlan ? "outline" : plan.key === "advanced" ? "premium" : plan.popular ? "hero" : "default"}
                    className="w-full"
                    disabled={isCurrentPlan || upgradingPlan !== null}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {upgradingPlan === plan.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : isSamePlanDifferentCycle ? (
                      selectedBillingCycle === "yearly" ? "Switch to Yearly" : "Switch to Monthly"
                    ) : plan.key === "free" ? (
                      currentPlan === "free" ? "Start Free Trial" : "Cancel Paid Plan"
                    ) : (
                      plan.cta
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* AI Credits Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2 className="font-display text-xl font-bold">AI Strategist Credits</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              AI Strategist credits power personalized YouTube growth recommendations. Each query consumes credits based on complexity:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-primary">20</div>
                <div className="text-sm text-muted-foreground">Basic Query</div>
                <div className="text-xs mt-1">Quick questions, simple advice</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-primary">50</div>
                <div className="text-sm text-muted-foreground">Standard Query</div>
                <div className="text-xs mt-1">Detailed analysis, strategy tips</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-primary">100</div>
                <div className="text-sm text-muted-foreground">Extensive Query</div>
                <div className="text-xs mt-1">In-depth research, comprehensive plans</div>
              </div>
            </div>
          </motion.div>

          {/* Feature Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border">
              <h2 className="font-display text-xl font-bold">Feature Comparison</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    {plans.map((plan) => (
                      <th key={plan.key} className="text-center p-4 font-semibold capitalize">
                        {plan.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, index) => (
                    <tr key={feature.name} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                      <td className="p-4 font-medium">{feature.name}</td>
                      {plans.map((plan) => {
                        const value = feature.getValue(plan.key);
                        return (
                          <td key={plan.key} className="text-center p-4">
                            {typeof value === "boolean" ? (
                              value ? (
                                <Check className="h-5 w-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground mx-auto" />
                              )
                            ) : (
                              <span className={typeof value === "number" || value === "Unlimited" ? "font-semibold" : "capitalize"}>
                                {value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Billing;

