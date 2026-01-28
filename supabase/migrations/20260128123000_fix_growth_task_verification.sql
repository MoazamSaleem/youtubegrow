-- Ensure verification fields exist for growth tasks and user growth tasks
ALTER TABLE public.growth_tasks
  ADD COLUMN IF NOT EXISTS verification_metric text,
  ADD COLUMN IF NOT EXISTS verification_operator text,
  ADD COLUMN IF NOT EXISTS verification_threshold numeric,
  ADD COLUMN IF NOT EXISTS verification_window_days integer;

ALTER TABLE public.user_growth_tasks
  ADD COLUMN IF NOT EXISTS verification_metric text,
  ADD COLUMN IF NOT EXISTS verification_operator text,
  ADD COLUMN IF NOT EXISTS verification_threshold numeric,
  ADD COLUMN IF NOT EXISTS verification_window_days integer;

ALTER TABLE public.user_task_progress
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.recurring_task_completions
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
