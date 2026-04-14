-- Harden credits and OAuth token permissions

-- Prevent client updates to OAuth token fields
DO $$
DECLARE
  oauth_columns text;
BEGIN
  IF to_regclass('public.youtube_channels') IS NULL THEN
    RAISE NOTICE 'Skipping youtube_channels OAuth privilege hardening because public.youtube_channels does not exist.';
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO oauth_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'youtube_channels'
    AND column_name IN ('access_token', 'refresh_token', 'token_expires_at');

  IF oauth_columns IS NULL THEN
    RAISE NOTICE 'Skipping youtube_channels OAuth privilege hardening because token columns do not exist.';
    RETURN;
  END IF;

  EXECUTE format(
    'REVOKE UPDATE (%s) ON public.youtube_channels FROM anon, authenticated',
    oauth_columns
  );
END $$;

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
