DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'text_to_video_generations_aspect_ratio_check'
      AND conrelid = 'public.text_to_video_generations'::regclass
  ) THEN
    ALTER TABLE public.text_to_video_generations
      DROP CONSTRAINT text_to_video_generations_aspect_ratio_check;
  END IF;

  ALTER TABLE public.text_to_video_generations
    ADD CONSTRAINT text_to_video_generations_aspect_ratio_check
    CHECK (aspect_ratio IN ('9:16', '1:1', '16:9'));
END $$;
