import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  Rocket,
  Lock,
} from "lucide-react";
import { PLAN_LIMITS, PLAN_ORDER, SubscriptionPlan, getPlanDisplayName } from "@/lib/planLimits";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SubscriptionPlan | null;
  targetFeature?: string;
  requiredPlan?: SubscriptionPlan;
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentPlan,
  targetFeature,
  requiredPlan,
}: UpgradeModalProps) {
  const currentIndex = currentPlan ? PLAN_ORDER.indexOf(currentPlan) : -1;
  const nextPlans = PLAN_ORDER.filter((_, index) => index > currentIndex);
  
  const planIcons: Record<SubscriptionPlan, React.ElementType> = {
    basic: Zap,
    pro: Crown,
    advanced: Rocket,
  };

  const planColors: Record<SubscriptionPlan, string> = {
    basic: "from-teal-500 to-teal-600",
    pro: "from-teal-500 to-cyan-500",
    advanced: "from-amber-500 to-orange-500",
  };

  const getUnlockedFeatures = (plan: SubscriptionPlan): string[] => {
    const limits = PLAN_LIMITS[plan];
    if (!currentPlan) {
      const features = [
        `Link up to ${limits.maxChannels} channels`,
        limits.hasAdvancedAnalytics ? "Advanced analytics" : "Basic analytics",
        limits.keywordsPerDay === -1 ? "Unlimited keywords/day" : `${limits.keywordsPerDay} keywords/day`,
        `${limits.topicsPerDay} topic suggestions/day`,
      ];

      if (limits.channelAnalysisFrequency !== "never") {
        features.push(
          limits.channelAnalysisFrequency === "unlimited"
            ? "Unlimited AI analysis"
            : `AI analysis ${limits.channelAnalysisFrequency}`
        );
      }
      if (limits.competitorAnalysisFrequency !== "never") {
        features.push(
          limits.competitorAnalysisFrequency === "daily"
            ? "Daily competitor analysis"
            : `Competitor analysis ${limits.competitorAnalysisFrequency}`
        );
      }
      if (limits.hasTextToVideo) {
        features.push("Text to Video");
      }
      if (limits.hasScriptWriter) {
        features.push("AI Script Writer");
      }
      if (limits.hasTextToSpeech) {
        features.push("Text to Speech");
      }
      if (limits.hasVoiceClone) {
        features.push("Voice Clone");
      }
      if (limits.thumbnailsPerDay === -1) {
        features.push("Unlimited thumbnails");
      } else if (limits.thumbnailsPerDay > 0) {
        features.push(`${limits.thumbnailsPerDay} thumbnails/day`);
      }
      if (limits.hasYoutubeStrategist) {
        features.push("YouTube Strategist AI");
      }
      if (limits.hasGrowthTasks) {
        features.push("Growth tasks & milestones");
      }
      features.push(`${limits.aiStrategistCredits.toLocaleString()} AI Credits/month`);

      return features;
    }

    const currentLimits = PLAN_LIMITS[currentPlan];
    const features: string[] = [];

    if (limits.maxChannels > currentLimits.maxChannels) {
      features.push(`Link up to ${limits.maxChannels} channels`);
    }
    if (limits.hasAdvancedAnalytics && !currentLimits.hasAdvancedAnalytics) {
      features.push("Advanced analytics");
    }
    if (limits.keywordsPerDay === -1 && currentLimits.keywordsPerDay !== -1) {
      features.push("Unlimited keywords/day");
    } else if (limits.keywordsPerDay > currentLimits.keywordsPerDay) {
      features.push(`${limits.keywordsPerDay} keywords/day`);
    }
    if (limits.topicsPerDay > currentLimits.topicsPerDay) {
      features.push(`${limits.topicsPerDay} topic suggestions/day`);
    }
    if (limits.channelAnalysisFrequency !== "never" && currentLimits.channelAnalysisFrequency === "never") {
      features.push("AI channel analysis");
    } else if (limits.channelAnalysisFrequency === "unlimited" && currentLimits.channelAnalysisFrequency !== "unlimited") {
      features.push("Unlimited AI analysis");
    }
    if (limits.competitorAnalysisFrequency !== "never" && currentLimits.competitorAnalysisFrequency === "never") {
      features.push("Competitor analysis");
    } else if (limits.competitorAnalysisFrequency === "daily" && currentLimits.competitorAnalysisFrequency !== "daily") {
      features.push("Daily competitor analysis");
    }
    if (limits.hasTextToVideo && !currentLimits.hasTextToVideo) {
      features.push("Text to Video");
    }
    if (limits.hasScriptWriter && !currentLimits.hasScriptWriter) {
      features.push("AI Script Writer");
    }
    if (limits.hasTextToSpeech && !currentLimits.hasTextToSpeech) {
      features.push("Text to Speech");
    }
    if (limits.hasVoiceClone && !currentLimits.hasVoiceClone) {
      features.push("Voice Clone");
    }
    if (limits.thumbnailsPerDay === -1 && currentLimits.thumbnailsPerDay !== -1) {
      features.push("Unlimited thumbnails");
    } else if (limits.thumbnailsPerDay > currentLimits.thumbnailsPerDay) {
      features.push(`${limits.thumbnailsPerDay} thumbnails/day`);
    }
    if (limits.hasYoutubeStrategist && !currentLimits.hasYoutubeStrategist) {
      features.push("YouTube Strategist AI");
    }
    if (limits.hasGrowthTasks && !currentLimits.hasGrowthTasks) {
      features.push("Growth tasks & milestones");
    }
    if (limits.aiStrategistCredits > currentLimits.aiStrategistCredits) {
      features.push(`${limits.aiStrategistCredits.toLocaleString()} AI Credits/month`);
    }

    return features;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-warning" />
            Unlock More Features
          </DialogTitle>
          <DialogDescription>
            {targetFeature
              ? `"${targetFeature}" requires ${getPlanDisplayName(requiredPlan || "basic")} plan or higher.`
              : "Upgrade your plan to access premium features and grow faster."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Current Plan */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 mb-6">
            {currentPlan ? (
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${planColors[currentPlan]} flex items-center justify-center`}>
                {(() => {
                  const Icon = planIcons[currentPlan];
                  return <Icon className="h-5 w-5 text-white" />;
                })()}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {currentPlan ? "Current Plan" : "Subscription Status"}
              </p>
              <p className="font-semibold">
                {currentPlan ? getPlanDisplayName(currentPlan) : "No active subscription"}
              </p>
            </div>
            {currentPlan !== "advanced" && (
              <Badge variant="outline" className="text-muted-foreground">
                {currentPlan ? "Upgrade available" : "Choose a plan"}
              </Badge>
            )}
          </div>

          {/* Available Upgrades */}
          <div className="space-y-4">
            {nextPlans.map((plan) => {
              const Icon = planIcons[plan];
              const limits = PLAN_LIMITS[plan];
              const unlockedFeatures = getUnlockedFeatures(plan);
              const isRecommended = requiredPlan === plan || (!requiredPlan && plan === "pro");

              return (
                <motion.div
                  key={plan}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border transition-colors ${
                    isRecommended
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${planColors[plan]} flex items-center justify-center shrink-0`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{getPlanDisplayName(plan)}</h4>
                        {isRecommended && (
                          <Badge className="bg-primary text-primary-foreground">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-2xl font-bold mb-3">
                        ${limits.price.monthly}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </p>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {unlockedFeatures.slice(0, 6).map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="text-muted-foreground truncate">{feature}</span>
                          </div>
                        ))}
                        {unlockedFeatures.length > 6 && (
                          <div className="text-sm text-muted-foreground">
                            +{unlockedFeatures.length - 6} more features
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant={isRecommended ? "hero" : "outline"}
                      className="shrink-0"
                      asChild
                    >
                      <Link to="/dashboard/billing" onClick={() => onOpenChange(false)}>
                        Upgrade
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button variant="link" asChild>
            <Link to="/dashboard/billing" onClick={() => onOpenChange(false)}>
              Compare all plans
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
