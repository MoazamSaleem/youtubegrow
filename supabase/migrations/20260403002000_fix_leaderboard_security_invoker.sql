-- Re-apply the security_invoker setting for the leaderboard view.
-- This preserves the existing view definition while making RLS/policies
-- evaluate in the caller's context instead of the view owner's context.
ALTER VIEW IF EXISTS public.leaderboard
  SET (security_invoker = true);

-- Ensure the intended read access remains in place after the view option update.
GRANT SELECT ON public.leaderboard TO authenticated;
