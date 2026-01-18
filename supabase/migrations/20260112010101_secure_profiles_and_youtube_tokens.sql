-- Require authentication for any access to profiles
CREATE POLICY "Profiles require authentication"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Prevent client roles from selecting sensitive OAuth token columns
REVOKE SELECT (access_token, refresh_token, token_expires_at)
  ON public.youtube_channels
  FROM anon, authenticated;
