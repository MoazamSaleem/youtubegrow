const PLAN_RANK = {
  basic: 0,
  pro: 1,
  advanced: 2,
} as const;

export type SubscriptionPlan = keyof typeof PLAN_RANK;

interface SubscriptionRecord {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const isFutureDate = (value?: string | null) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const isSubscriptionPlan = (value: string | null | undefined): value is SubscriptionPlan => {
  return value === "basic" || value === "pro" || value === "advanced";
};

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const isSubscriptionCurrentlyActive = (
  subscription?: SubscriptionRecord | null
) => {
  if (!subscription || !isSubscriptionPlan(subscription.plan)) return false;

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

const getSubscriptionPriority = (subscription?: SubscriptionRecord | null) => {
  if (!subscription) return -100;

  const planPriority = isSubscriptionPlan(subscription.plan) ? PLAN_RANK[subscription.plan] : -1;

  switch (subscription.status) {
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
      return -10;
  }
};

export const selectBestSubscriptionRecord = <T extends SubscriptionRecord>(
  subscriptions?: T[] | null
): T | null => {
  if (!subscriptions?.length) return null;

  return [...subscriptions].sort((left, right) => {
    const priorityDiff = getSubscriptionPriority(right) - getSubscriptionPriority(left);
    if (priorityDiff !== 0) return priorityDiff;

    const periodDiff =
      getTimestamp(right.current_period_end) - getTimestamp(left.current_period_end);
    if (periodDiff !== 0) return periodDiff;

    const updatedDiff = getTimestamp(right.updated_at) - getTimestamp(left.updated_at);
    if (updatedDiff !== 0) return updatedDiff;

    return getTimestamp(right.created_at) - getTimestamp(left.created_at);
  })[0] ?? null;
};

export const getActiveSubscriptionPlan = async (
  supabaseClient: any,
  userId: string
): Promise<SubscriptionPlan | null> => {
  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("plan, status, current_period_end, trial_ends_at, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const record = selectBestSubscriptionRecord((data ?? []) as SubscriptionRecord[]);

  if (!record || !isSubscriptionPlan(record.plan)) {
    return null;
  }

  return isSubscriptionCurrentlyActive(record) ? record.plan : null;
};

export const requireMinimumPlan = async ({
  supabaseClient,
  userId,
  minimumPlan,
  corsHeaders,
  message,
}: {
  supabaseClient: any;
  userId: string;
  minimumPlan: SubscriptionPlan;
  corsHeaders: Record<string, string>;
  message: string;
}) => {
  const plan = await getActiveSubscriptionPlan(supabaseClient, userId);

  if (!plan || PLAN_RANK[plan] < PLAN_RANK[minimumPlan]) {
    return new Response(JSON.stringify({ error: message }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null;
};
