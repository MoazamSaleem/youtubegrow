import { PLAN_ORDER, SubscriptionPlan } from "./planLimits";

export interface SubscriptionLike {
  plan?: SubscriptionPlan | null;
  status?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const PLAN_RANK: Record<SubscriptionPlan, number> = PLAN_ORDER.reduce(
  (acc, plan, index) => {
    acc[plan] = index;
    return acc;
  },
  {} as Record<SubscriptionPlan, number>
);

export const isFutureDate = (value?: string | null) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

export const getSubscriptionPlan = (
  subscription?: SubscriptionLike | null
): SubscriptionPlan | null => {
  return subscription?.plan ?? null;
};

export const isSubscriptionEntitled = (
  subscription?: SubscriptionLike | null
): boolean => {
  if (!subscription?.plan) return false;

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

export const getActiveSubscriptionPlan = (
  subscription?: SubscriptionLike | null
): SubscriptionPlan | null => {
  return isSubscriptionEntitled(subscription) ? subscription?.plan ?? null : null;
};

export const hasActiveSubscription = (
  subscription?: SubscriptionLike | null
): boolean => {
  return getActiveSubscriptionPlan(subscription) !== null;
};

export const hasMinimumPlan = (
  plan: SubscriptionPlan | null | undefined,
  minimumPlan: SubscriptionPlan
): boolean => {
  if (!plan) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[minimumPlan];
};

const getPlanPriority = (plan?: SubscriptionPlan | null) => {
  if (!plan) return -1;
  return PLAN_RANK[plan];
};

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getSubscriptionPriority = (subscription?: SubscriptionLike | null) => {
  const planPriority = getPlanPriority(subscription?.plan);

  switch (subscription?.status) {
    case "active":
      return 120 + planPriority;
    case "trialing":
      return 110 + planPriority;
    case "cancelled":
    case "canceled":
      return isFutureDate(subscription.trial_ends_at || subscription.current_period_end)
        ? 100 + planPriority
        : 10 + planPriority;
    case "pending":
      return 50 + planPriority;
    case "inactive":
      return 20 + planPriority;
    case "expired":
      return 0 + planPriority;
    default:
      return -10 + planPriority;
  }
};

export function selectBestSubscription<T extends SubscriptionLike>(
  subscriptions?: T[] | null
): T | null {
  if (!subscriptions?.length) return null;

  return [...subscriptions].sort((left, right) => {
    const priorityDiff = getSubscriptionPriority(right) - getSubscriptionPriority(left);
    if (priorityDiff !== 0) return priorityDiff;

    const currentPeriodDiff =
      getTimestamp(right.current_period_end) - getTimestamp(left.current_period_end);
    if (currentPeriodDiff !== 0) return currentPeriodDiff;

    const updatedAtDiff = getTimestamp(right.updated_at) - getTimestamp(left.updated_at);
    if (updatedAtDiff !== 0) return updatedAtDiff;

    return getTimestamp(right.created_at) - getTimestamp(left.created_at);
  })[0] ?? null;
}
