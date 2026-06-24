ALTER TABLE public.projects
  ALTER COLUMN caption_style SET DEFAULT '{
    "preset": "viral_pop",
    "font": "bold_sans",
    "active_color": "#FFD60A",
    "phrase_color": "#FFFFFF",
    "phrase_opacity": 0.55,
    "position": "bottom",
    "position_x": 50,
    "position_y": 72,
    "box_width": 76,
    "box_height": 16,
    "border_enabled": false,
    "border_color": "#FFFFFF",
    "border_width": 2,
    "size_active": 96,
    "size_phrase": 42,
    "stroke_width": 6,
    "background": "none",
    "uppercase": true,
    "animation": "pop",
    "show_phrase": true
  }'::jsonb;

UPDATE public.projects
SET caption_style =
  COALESCE(caption_style, '{}'::jsonb) ||
  jsonb_build_object(
    'position_x', COALESCE(caption_style->'position_x', '50'::jsonb),
    'position_y', COALESCE(caption_style->'position_y', '72'::jsonb),
    'box_width', COALESCE(caption_style->'box_width', '76'::jsonb),
    'box_height', COALESCE(caption_style->'box_height', '16'::jsonb),
    'border_enabled', COALESCE(caption_style->'border_enabled', 'false'::jsonb),
    'border_color', COALESCE(caption_style->'border_color', '"#FFFFFF"'::jsonb),
    'border_width', COALESCE(caption_style->'border_width', '2'::jsonb)
  )
WHERE NOT (caption_style ? 'position_x')
   OR NOT (caption_style ? 'position_y')
   OR NOT (caption_style ? 'box_width')
   OR NOT (caption_style ? 'box_height')
   OR NOT (caption_style ? 'border_enabled')
   OR NOT (caption_style ? 'border_color')
   OR NOT (caption_style ? 'border_width');
