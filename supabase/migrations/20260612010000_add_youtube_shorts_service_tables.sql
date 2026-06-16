CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Video',
  aspect TEXT NOT NULL DEFAULT '9:16',
  script TEXT NOT NULL DEFAULT '',
  voice TEXT NOT NULL DEFAULT 'nova',
  caption_theme TEXT NOT NULL DEFAULT 'viral_pop',
  status TEXT NOT NULL DEFAULT 'draft',
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  music_url TEXT,
  music_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline_layers JSONB NOT NULL DEFAULT '[]'::jsonb,
  music_timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_duration NUMERIC NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  final_video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.renders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT 'Queued',
  final_video_url TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at
  ON public.projects (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_renders_project_id
  ON public.renders (project_id);

CREATE INDEX IF NOT EXISTS idx_renders_created_at
  ON public.renders (created_at DESC);
