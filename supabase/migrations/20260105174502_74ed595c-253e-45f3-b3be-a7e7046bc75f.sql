-- Fix security definer view issue by using security invoker
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard 
WITH (security_invoker = true) AS
SELECT 
  ut.user_id,
  COALESCE(ut.display_name, CONCAT('Creator #', SUBSTR(ut.user_id::text, 1, 8))) as display_name,
  ut.current_xp,
  ut.total_earned as tokens_earned,
  ut.balance as token_balance,
  p.avatar_url,
  RANK() OVER (ORDER BY ut.current_xp DESC) as xp_rank,
  RANK() OVER (ORDER BY ut.total_earned DESC) as tokens_rank
FROM public.user_tokens ut
LEFT JOIN public.profiles p ON p.user_id = ut.user_id
WHERE ut.show_on_leaderboard = true
ORDER BY ut.current_xp DESC;

-- Grant select to authenticated users
GRANT SELECT ON public.leaderboard TO authenticated;

-- Add policy to allow all authenticated users to read leaderboard data from user_tokens
CREATE POLICY "Anyone can view leaderboard data" 
ON public.user_tokens FOR SELECT 
USING (show_on_leaderboard = true);