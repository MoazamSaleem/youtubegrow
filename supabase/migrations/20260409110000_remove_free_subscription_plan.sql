-- Remove the legacy free subscription plan and stop auto-provisioning subscriptions on signup.

UPDATE public.subscriptions
SET
  plan = 'basic',
  status = 'inactive',
  billing_cycle = COALESCE(billing_cycle, 'monthly'),
  trial_started_at = NULL,
  trial_ends_at = NULL,
  current_period_start = COALESCE(current_period_start, now()),
  current_period_end = now(),
  updated_at = now()
WHERE plan::text = 'free';

ALTER TABLE public.subscriptions
ALTER COLUMN plan DROP DEFAULT;

ALTER TABLE public.subscriptions
DROP COLUMN IF EXISTS has_used_free_trial;

DROP VIEW IF EXISTS public.user_subscription_summary;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'subscription_plan_new'
  ) THEN
    DROP TYPE public.subscription_plan_new;
  END IF;
END $$;

CREATE TYPE public.subscription_plan_new AS ENUM ('basic', 'pro', 'advanced');

ALTER TABLE public.subscriptions
ALTER COLUMN plan TYPE public.subscription_plan_new
USING (
  CASE
    WHEN plan::text = 'free' THEN 'basic'
    ELSE plan::text
  END::public.subscription_plan_new
);

DROP TYPE public.subscription_plan;
ALTER TYPE public.subscription_plan_new RENAME TO subscription_plan;

CREATE VIEW public.user_subscription_summary
WITH (security_invoker = true) AS
SELECT
  user_id,
  plan,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  trial_ends_at,
  created_at,
  updated_at
FROM public.subscriptions;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;
