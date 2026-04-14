-- Repair duplicate daily usage rows and reassert the one-row-per-user-per-day invariant.

WITH merged_usage AS (
  SELECT
    user_id,
    date,
    MAX(COALESCE(keywords_used, 0)) AS keywords_used,
    MAX(COALESCE(topics_generated, 0)) AS topics_generated,
    MAX(COALESCE(thumbnails_generated, 0)) AS thumbnails_generated,
    MAX(COALESCE(channel_analyses, 0)) AS channel_analyses,
    MAX(COALESCE(competitor_analyses, 0)) AS competitor_analyses,
    MAX(COALESCE(scripts_generated, 0)) AS scripts_generated,
    MIN(created_at) AS created_at,
    (ARRAY_AGG(id ORDER BY created_at DESC, id DESC))[1] AS keep_id
  FROM public.usage_tracking
  GROUP BY user_id, date
),
updated_usage AS (
  UPDATE public.usage_tracking AS usage_tracking
  SET
    keywords_used = merged_usage.keywords_used,
    topics_generated = merged_usage.topics_generated,
    thumbnails_generated = merged_usage.thumbnails_generated,
    channel_analyses = merged_usage.channel_analyses,
    competitor_analyses = merged_usage.competitor_analyses,
    scripts_generated = merged_usage.scripts_generated,
    created_at = merged_usage.created_at
  FROM merged_usage
  WHERE usage_tracking.id = merged_usage.keep_id
  RETURNING usage_tracking.user_id, usage_tracking.date
)
DELETE FROM public.usage_tracking AS usage_tracking
USING merged_usage
WHERE usage_tracking.user_id = merged_usage.user_id
  AND usage_tracking.date = merged_usage.date
  AND usage_tracking.id <> merged_usage.keep_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.usage_tracking'::regclass
      AND conname = 'usage_tracking_user_id_date_key'
  ) THEN
    ALTER TABLE public.usage_tracking
      ADD CONSTRAINT usage_tracking_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;
