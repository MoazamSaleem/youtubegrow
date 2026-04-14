-- Require authentication for any access to profiles
DROP POLICY IF EXISTS "Profiles require authentication" ON public.profiles;

CREATE POLICY "Profiles require authentication"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Prevent client roles from selecting sensitive OAuth token columns
DO $$
DECLARE
  oauth_columns text;
BEGIN
  IF to_regclass('public.youtube_channels') IS NULL THEN
    RAISE NOTICE 'Skipping youtube_channels OAuth select hardening because public.youtube_channels does not exist.';
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO oauth_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'youtube_channels'
    AND column_name IN ('access_token', 'refresh_token', 'token_expires_at');

  IF oauth_columns IS NULL THEN
    RAISE NOTICE 'Skipping youtube_channels OAuth select hardening because token columns do not exist.';
    RETURN;
  END IF;

  EXECUTE format(
    'REVOKE SELECT (%s) ON public.youtube_channels FROM anon, authenticated',
    oauth_columns
  );
END $$;
