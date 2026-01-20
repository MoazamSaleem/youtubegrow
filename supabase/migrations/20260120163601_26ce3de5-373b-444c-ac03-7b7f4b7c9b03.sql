-- 1. Create a separate table for sensitive Stripe data (only accessible via edge functions)
CREATE TABLE public.subscription_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on subscription_secrets
ALTER TABLE public.subscription_secrets ENABLE ROW LEVEL SECURITY;

-- Only allow service role access (edge functions) - no direct user access
CREATE POLICY "No direct user access to subscription secrets"
  ON public.subscription_secrets FOR SELECT
  USING (false);

-- 2. Migrate existing Stripe data to the new table
INSERT INTO public.subscription_secrets (user_id, stripe_customer_id, stripe_subscription_id, created_at, updated_at)
SELECT user_id, stripe_customer_id, stripe_subscription_id, created_at, updated_at
FROM public.subscriptions
WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  updated_at = now();

-- 3. Remove sensitive columns from subscriptions table
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;

-- 4. Create secure view for subscription summary (with RLS via security_invoker)
DROP VIEW IF EXISTS public.user_subscription_summary;
CREATE VIEW public.user_subscription_summary
WITH (security_invoker = on) AS
SELECT 
  user_id,
  plan,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  trial_ends_at,
  created_at,
  updated_at
FROM public.subscriptions;

-- 5. Restrict user_badges to only show badges for users on leaderboard or own badges
DROP POLICY IF EXISTS "Users can view all user badges" ON public.user_badges;

CREATE POLICY "Users can view their own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view badges of leaderboard participants"
  ON public.user_badges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE user_tokens.user_id = user_badges.user_id 
      AND user_tokens.show_on_leaderboard = true
    )
  );

-- 6. Create helper function to get Stripe customer ID (for edge functions only)
CREATE OR REPLACE FUNCTION public.get_stripe_customer_id(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stripe_customer_id 
  FROM public.subscription_secrets 
  WHERE user_id = p_user_id;
$$;

-- 7. Create helper function to get Stripe subscription ID (for edge functions only)
CREATE OR REPLACE FUNCTION public.get_stripe_subscription_id(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stripe_subscription_id 
  FROM public.subscription_secrets 
  WHERE user_id = p_user_id;
$$;

-- 8. Create helper function to upsert Stripe data (for edge functions only)
CREATE OR REPLACE FUNCTION public.upsert_stripe_data(
  p_user_id UUID,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscription_secrets (user_id, stripe_customer_id, stripe_subscription_id)
  VALUES (p_user_id, p_stripe_customer_id, p_stripe_subscription_id)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = COALESCE(p_stripe_customer_id, subscription_secrets.stripe_customer_id),
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, subscription_secrets.stripe_subscription_id),
    updated_at = now();
END;
$$;