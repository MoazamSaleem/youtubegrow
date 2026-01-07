-- Fix SECURITY DEFINER views - convert to SECURITY INVOKER

-- Drop and recreate the user_subscription_summary view with SECURITY INVOKER
DROP VIEW IF EXISTS public.user_subscription_summary;
CREATE VIEW public.user_subscription_summary 
WITH (security_invoker = true) AS
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

-- Drop and recreate the leaderboard view with SECURITY INVOKER
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard 
WITH (security_invoker = true) AS
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