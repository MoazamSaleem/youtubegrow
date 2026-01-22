CREATE TABLE IF NOT EXISTS public.channel_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_analysis_results_user_channel_idx
  ON public.channel_analysis_results (user_id, channel_id);

ALTER TABLE public.channel_analysis_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_analysis_results'
      AND policyname = 'Users can read own channel analyses'
  ) THEN
    CREATE POLICY "Users can read own channel analyses"
      ON public.channel_analysis_results
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_analysis_results'
      AND policyname = 'Users can insert own channel analyses'
  ) THEN
    CREATE POLICY "Users can insert own channel analyses"
      ON public.channel_analysis_results
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_analysis_results'
      AND policyname = 'Users can update own channel analyses'
  ) THEN
    CREATE POLICY "Users can update own channel analyses"
      ON public.channel_analysis_results
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
