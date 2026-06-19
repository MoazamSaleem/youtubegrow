ALTER TABLE public.text_to_video_generations
  ADD COLUMN IF NOT EXISTS provider_project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_text_to_video_generations_provider_project_id
  ON public.text_to_video_generations (provider_project_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS caption_style JSONB NOT NULL DEFAULT '{
    "preset": "viral_pop",
    "font": "bold_sans",
    "active_color": "#FFD60A",
    "phrase_color": "#FFFFFF",
    "phrase_opacity": 0.55,
    "position": "bottom",
    "size_active": 96,
    "size_phrase": 42,
    "stroke_width": 6,
    "background": "none",
    "uppercase": true,
    "animation": "pop",
    "show_phrase": true
  }'::jsonb;
