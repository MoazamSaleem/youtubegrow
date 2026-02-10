-- Harden credits and OAuth token permissions

-- Prevent client updates to OAuth token fields
REVOKE UPDATE (access_token, refresh_token, token_expires_at)
  ON public.youtube_channels
  FROM anon, authenticated;

-- Prevent client-side manipulation of token balances/credits
REVOKE INSERT, UPDATE, DELETE
  ON public.user_tokens
  FROM anon, authenticated;

-- Allow profile-related updates only
GRANT UPDATE (display_name, show_on_leaderboard, displayed_badges, updated_at)
  ON public.user_tokens
  TO authenticated;

-- Prevent client-side credits history manipulation
REVOKE INSERT, UPDATE, DELETE
  ON public.credits_history
  FROM anon, authenticated;

-- Prevent client-side credits purchase manipulation
REVOKE INSERT, UPDATE, DELETE
  ON public.credits_purchases
  FROM anon, authenticated;

-- Prevent client-side AI credits usage manipulation
REVOKE INSERT, UPDATE, DELETE
  ON public.ai_credits_usage
  FROM anon, authenticated;
