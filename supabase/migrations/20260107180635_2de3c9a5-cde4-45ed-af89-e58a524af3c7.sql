-- Update youtube_channels table to store OAuth tokens securely
-- First check if columns exist and add them if not

-- Add missing columns for OAuth tokens if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'youtube_channels' AND column_name = 'access_token') THEN
    ALTER TABLE public.youtube_channels ADD COLUMN access_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'youtube_channels' AND column_name = 'refresh_token') THEN
    ALTER TABLE public.youtube_channels ADD COLUMN refresh_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'youtube_channels' AND column_name = 'token_expires_at') THEN
    ALTER TABLE public.youtube_channels ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'youtube_channels' AND column_name = 'channel_thumbnail') THEN
    ALTER TABLE public.youtube_channels ADD COLUMN channel_thumbnail TEXT;
  END IF;
END $$;

-- Create unique constraint on user_id + channel_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'youtube_channels_user_channel_unique') THEN
    ALTER TABLE public.youtube_channels ADD CONSTRAINT youtube_channels_user_channel_unique UNIQUE (user_id, channel_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their own channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Users can insert their own channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Users can update their own channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Users can delete their own channels" ON public.youtube_channels;

-- Create RLS policies for youtube_channels
CREATE POLICY "Users can view their own channels"
  ON public.youtube_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own channels"
  ON public.youtube_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channels"
  ON public.youtube_channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channels"
  ON public.youtube_channels FOR DELETE
  USING (auth.uid() = user_id);