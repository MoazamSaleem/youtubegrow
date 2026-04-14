export const PLAN_ORDER = ["basic", "pro", "advanced"] as const;

export type SubscriptionPlan = (typeof PLAN_ORDER)[number];

export interface PlanLimits {
  maxChannels: number;
  keywordsPerDay: number;
  topicsPerDay: number;
  thumbnailsPerDay: number;
  channelAnalysisFrequency: "never" | "weekly" | "unlimited";
  competitorAnalysisFrequency: "never" | "weekly" | "daily";
  hasScriptWriter: boolean;
  hasTextToSpeech: boolean;
  hasVoiceClone: boolean;
  hasAdvancedAnalytics: boolean;
  hasGrowthTasks: boolean;
  hasYoutubeStrategist: boolean;
  aiStrategistCredits: number;
  growthTasksTier: "none" | "basic" | "pro" | "advanced";
  price: {
    monthly: number;
    yearly: number;
  };
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  basic: {
    maxChannels: 1,
    keywordsPerDay: 50,
    topicsPerDay: 5,
    thumbnailsPerDay: 0,
    channelAnalysisFrequency: "weekly",
    competitorAnalysisFrequency: "weekly",
    hasScriptWriter: false,
    hasTextToSpeech: false,
    hasVoiceClone: false,
    hasAdvancedAnalytics: false,
    hasGrowthTasks: true,
    hasYoutubeStrategist: false,
    aiStrategistCredits: 1000,
    growthTasksTier: "basic",
    price: {
      monthly: 7,
      yearly: 70,
    },
  },
  pro: {
    maxChannels: 3,
    keywordsPerDay: 150,
    topicsPerDay: 10,
    thumbnailsPerDay: 5,
    channelAnalysisFrequency: "weekly",
    competitorAnalysisFrequency: "weekly",
    hasScriptWriter: true,
    hasTextToSpeech: true,
    hasVoiceClone: true,
    hasAdvancedAnalytics: true,
    hasGrowthTasks: true,
    hasYoutubeStrategist: true,
    aiStrategistCredits: 10000,
    growthTasksTier: "pro",
    price: {
      monthly: 15,
      yearly: 120,
    },
  },
  advanced: {
    maxChannels: 10,
    keywordsPerDay: -1, // unlimited
    topicsPerDay: 20,
    thumbnailsPerDay: -1, // unlimited
    channelAnalysisFrequency: "unlimited",
    competitorAnalysisFrequency: "daily",
    hasScriptWriter: true,
    hasTextToSpeech: true,
    hasVoiceClone: true,
    hasAdvancedAnalytics: true,
    hasGrowthTasks: true,
    hasYoutubeStrategist: true,
    aiStrategistCredits: 25000,
    growthTasksTier: "advanced",
    price: {
      monthly: 25,
      yearly: 230,
    },
  },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canAccessFeature(
  plan: SubscriptionPlan | null | undefined,
  feature: keyof PlanLimits
): boolean {
  if (!plan) return false;

  const limits = PLAN_LIMITS[plan];
  const value = limits[feature];
  
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "never";
  return true;
}

export function getPlanDisplayName(plan: SubscriptionPlan | null | undefined): string {
  if (!plan) return "No Active Plan";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
