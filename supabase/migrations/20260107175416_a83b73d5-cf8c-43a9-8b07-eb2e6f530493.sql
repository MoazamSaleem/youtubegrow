-- Fix security issues: Restrict access to sensitive profile and subscription data

-- 1. Drop existing overly permissive policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. Create more restrictive profile policies (exclude email from being queryable by others)
-- Users can only view their own profile
CREATE POLICY "Users can view own profile only"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile  
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles (for admin dashboard)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Drop existing subscription policies
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;

-- 4. Create a secure view for user subscription data (without Stripe IDs)
CREATE OR REPLACE VIEW public.user_subscription_summary AS
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

-- 5. Create new restrictive subscription policies
-- Users can view their own subscription (full record for their own data)
CREATE POLICY "Users view own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update subscriptions
CREATE POLICY "Admins update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Fix leaderboard view - ensure it only shows public data
DROP VIEW IF EXISTS public.leaderboard;
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  ut.user_id,
  ut.display_name,
  ut.current_xp,
  ut.balance as token_balance,
  ut.total_earned as tokens_earned,
  p.avatar_url,
  RANK() OVER (ORDER BY ut.current_xp DESC) as xp_rank,
  RANK() OVER (ORDER BY ut.total_earned DESC) as tokens_rank
FROM public.user_tokens ut
LEFT JOIN public.profiles p ON ut.user_id = p.user_id
WHERE ut.show_on_leaderboard = true;