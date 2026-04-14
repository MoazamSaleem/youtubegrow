CREATE TABLE IF NOT EXISTS public.tts_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_input TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  voice_label TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('neutral', 'calm', 'cheerful', 'serious', 'dramatic', 'energetic')),
  style TEXT NOT NULL CHECK (style IN ('conversational', 'narration', 'commercial', 'podcast', 'storytelling', 'cinematic')),
  speed NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  output_format TEXT NOT NULL CHECK (output_format IN ('mp3', 'wav')),
  char_count INTEGER NOT NULL,
  credits_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  audio_path TEXT,
  audio_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tts_generations_user_created_at
  ON public.tts_generations (user_id, created_at DESC);

ALTER TABLE public.tts_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tts generations"
  ON public.tts_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tts generations"
  ON public.tts_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tts generations"
  ON public.tts_generations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', true)
ON CONFLICT (id) DO NOTHING;
