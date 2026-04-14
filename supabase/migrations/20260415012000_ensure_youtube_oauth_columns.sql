DO $$
BEGIN
  IF to_regclass('public.youtube_channels') IS NULL THEN
    RAISE NOTICE 'Skipping youtube OAuth column repair because public.youtube_channels does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.youtube_channels
    ADD COLUMN IF NOT EXISTS access_token TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
END $$;

NOTIFY pgrst, 'reload schema';
