alter table public.user_task_progress
  add column if not exists verified_at timestamptz,
  add column if not exists claimed_at timestamptz;

alter table public.recurring_task_completions
  add column if not exists verified_at timestamptz,
  add column if not exists claimed_at timestamptz;
