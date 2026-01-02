import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PLAN_LIMITS, SubscriptionPlan, getPlanDisplayName } from "@/lib/planLimits";
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
} from "lucide-react";

const Billing = () => {
  const navigate = useNavigate();
  const { user, subscription, loading } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

  const currentPlan = subscription?.plan || "free";

  const plans: { key: SubscriptionPlan; icon: React.ElementType; color: string; popular?: boolean }[] = [
    { key: "free", icon: Zap, color: "from-slate-500 to-slate-600" },
    { key: "basic", icon: Star, color: "from-blue-500 to-blue-600" },
    { key: "pro", icon: Crown, color: "from-purple-500 to-purple-600", popular: true },
    { key: "advanced", icon: Rocket, color: "from-orange-500 to-orange-600" },
  ];

  const features = [
    { name: "Channels", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].maxChannels },
    { name: "Keywords/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].keywordsPerDay === -1 ? "Unlimited" : PLAN_LIMITS[p].keywordsPerDay },
    { name: "Topics/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].topicsPerDay },
    { name: "Thumbnails/day", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].thumbnailsPerDay === -1 ? "Unlimited" : PLAN_LIMITS[p].thumbnailsPerDay || "—" },
    { name: "Channel Analysis", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].channelAnalysisFrequency === "never" ? false : PLAN_LIMITS[p].channelAnalysisFrequency },
    { name: "Competitor Analysis", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].competitorAnalysisFrequency === "never" ? false : PLAN_LIMITS[p].competitorAnalysisFrequency },
    { name: "Script Writer", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasScriptWriter },
    { name: "Advanced Analytics", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasAdvancedAnalytics },
    { name: "Growth Tasks", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasGrowthTasks },
    { name: "AI Strategist", getValue: (p: SubscriptionPlan) => PLAN_LIMITS[p].hasYoutubeStrategist },
  ];

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan === currentPlan) return;
    
    setUpgradingPlan(plan);
    try {
      // For now, we'll just update the subscription in the database
      // In production, this would integrate with Stripe
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan,
          billing_cycle: isYearly ? "yearly" : "monthly",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: `Successfully ${plan === "free" ? "downgraded" : "upgraded"} to ${getPlanDisplayName(plan)}!`,
        description: "Your plan has been updated.",
      });

      // Refresh the page to update the subscription
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating subscription:", error);
      toast({
        title: "Failed to update subscription",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const getPrice = (plan: SubscriptionPlan) => {
    const prices = PLAN_LIMITS[plan].price;
    return isYearly ? prices.yearly : prices.monthly;
  };

  const getSavings = (plan: SubscriptionPlan) => {
    const prices = PLAN_LIMITS[plan].price;
    if (prices.monthly === 0) return 0;
    const yearlyEquivalent = prices.monthly * 12;
    return yearlyEquivalent - prices.yearly;
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
              const limits = PLAN_LIMITS[plan.key];
              const isCurrentPlan = currentPlan === plan.key;
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
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {limits.maxChannels} channel{limits.maxChannels > 1 ? "s" : ""}
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {limits.keywordsPerDay === -1 ? "Unlimited" : limits.keywordsPerDay} keywords/day
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {limits.topicsPerDay} topics/day
                    </li>
                    {limits.hasScriptWriter && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        Script Writer
                      </li>
                    )}
                    {limits.hasAdvancedAnalytics && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        Advanced Analytics
                      </li>
                    )}
                  </ul>

                  <Button
                    variant={isCurrentPlan ? "outline" : plan.popular ? "glow" : "default"}
                    className="w-full"
                    disabled={isCurrentPlan || upgradingPlan !== null}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {upgradingPlan === plan.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : plan.key === "free" ? (
                      "Downgrade"
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>

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
                              <span className={typeof value === "number" || value === "Unlimited" ? "font-semibold" : ""}>
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
