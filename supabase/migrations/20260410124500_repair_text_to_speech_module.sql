CREATE TABLE IF NOT EXISTS public.tts_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_input TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  voice_label TEXT NOT NULL,
  mood TEXT NOT NULL,
  style TEXT NOT NULL,
  speed NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  output_format TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  credits_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  audio_path TEXT,
  audio_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.tts_generations
  ADD COLUMN IF NOT EXISTS text_input TEXT,
  ADD COLUMN IF NOT EXISTS voice_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_label TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS speed NUMERIC(3,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS output_format TEXT,
  ADD COLUMN IF NOT EXISTS char_count INTEGER,
  ADD COLUMN IF NOT EXISTS credits_used INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tts_generations_user_created_at
  ON public.tts_generations (user_id, created_at DESC);

ALTER TABLE public.tts_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tts_generations_mood_check'
      AND conrelid = 'public.tts_generations'::regclass
  ) THEN
    ALTER TABLE public.tts_generations
      ADD CONSTRAINT tts_generations_mood_check
      CHECK (mood IN ('neutral', 'calm', 'cheerful', 'serious', 'dramatic', 'energetic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tts_generations_style_check'
      AND conrelid = 'public.tts_generations'::regclass
  ) THEN
    ALTER TABLE public.tts_generations
      ADD CONSTRAINT tts_generations_style_check
      CHECK (style IN ('conversational', 'narration', 'commercial', 'podcast', 'storytelling', 'cinematic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tts_generations_output_format_check'
      AND conrelid = 'public.tts_generations'::regclass
  ) THEN
    ALTER TABLE public.tts_generations
      ADD CONSTRAINT tts_generations_output_format_check
      CHECK (output_format IN ('mp3', 'wav'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tts_generations_status_check'
      AND conrelid = 'public.tts_generations'::regclass
  ) THEN
    ALTER TABLE public.tts_generations
      ADD CONSTRAINT tts_generations_status_check
      CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their own tts generations" ON public.tts_generations;
CREATE POLICY "Users can view their own tts generations"
  ON public.tts_generations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tts generations" ON public.tts_generations;
CREATE POLICY "Users can insert their own tts generations"
  ON public.tts_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all tts generations" ON public.tts_generations;
CREATE POLICY "Admins can view all tts generations"
  ON public.tts_generations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;
