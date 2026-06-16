CREATE TABLE IF NOT EXISTS public.text_to_video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'vertical-short',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  duration_seconds INTEGER NOT NULL,
  credits_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  video_url TEXT,
  provider_job_id TEXT,
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_text_to_video_generations_user_created_at
  ON public.text_to_video_generations (user_id, created_at DESC);

ALTER TABLE public.text_to_video_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'text_to_video_generations_status_check'
      AND conrelid = 'public.text_to_video_generations'::regclass
  ) THEN
    ALTER TABLE public.text_to_video_generations
      ADD CONSTRAINT text_to_video_generations_status_check
      CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'text_to_video_generations_aspect_ratio_check'
      AND conrelid = 'public.text_to_video_generations'::regclass
  ) THEN
    ALTER TABLE public.text_to_video_generations
      ADD CONSTRAINT text_to_video_generations_aspect_ratio_check
      CHECK (aspect_ratio IN ('9:16', '16:9'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their own text to video generations" ON public.text_to_video_generations;
CREATE POLICY "Users can view their own text to video generations"
  ON public.text_to_video_generations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own text to video generations" ON public.text_to_video_generations;
CREATE POLICY "Users can insert their own text to video generations"
  ON public.text_to_video_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all text to video generations" ON public.text_to_video_generations;
CREATE POLICY "Admins can view all text to video generations"
  ON public.text_to_video_generations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
