DO $$
DECLARE
  user_id_attnum smallint;
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE NOTICE 'Skipping subscription dedupe migration because public.subscriptions does not exist.';
    RETURN;
  END IF;

  EXECUTE $sql$
    WITH ranked_subscriptions AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY
            CASE
              WHEN status = 'active' AND current_period_end > now() THEN 6
              WHEN status = 'trialing' AND COALESCE(trial_ends_at, current_period_end) > now() THEN 5
              WHEN status = 'pending' THEN 4
              WHEN status = 'inactive' THEN 3
              WHEN status IN ('cancelled', 'canceled') THEN 2
              WHEN status = 'expired' THEN 1
              ELSE 0
            END DESC,
            CASE
              WHEN plan = 'advanced' THEN 3
              WHEN plan = 'pro' THEN 2
              WHEN plan = 'basic' THEN 1
              ELSE 0
            END DESC,
            COALESCE(current_period_end, now()) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            COALESCE(created_at, now()) DESC
        ) AS row_rank
      FROM public.subscriptions
    ),
    duplicate_subscriptions AS (
      SELECT id
      FROM ranked_subscriptions
      WHERE row_rank > 1
    )
    DELETE FROM public.subscriptions
    WHERE id IN (SELECT id FROM duplicate_subscriptions)
  $sql$;

  SELECT attnum
  INTO user_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.subscriptions'::regclass
    AND attname = 'user_id'
    AND NOT attisdropped;

  IF user_id_attnum IS NULL THEN
    RAISE NOTICE 'Skipping unique constraint enforcement because subscriptions.user_id was not found.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[user_id_attnum]
  ) THEN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
