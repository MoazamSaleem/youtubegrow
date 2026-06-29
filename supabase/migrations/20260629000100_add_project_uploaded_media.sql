ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS uploaded_media JSONB NOT NULL DEFAULT '[]'::jsonb;
