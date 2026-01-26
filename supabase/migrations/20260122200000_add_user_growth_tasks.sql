create table if not exists public.user_growth_task_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  step_index integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists user_growth_task_sets_user_id_idx
  on public.user_growth_task_sets (user_id, step_index desc);

create table if not exists public.user_growth_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_set_id uuid not null references public.user_growth_task_sets(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  token_reward integer not null default 10,
  xp_reward integer not null default 50,
  order_index integer not null default 0,
  verification_metric text,
  verification_operator text,
  verification_threshold numeric,
  verification_window_days integer,
  verified_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_growth_tasks_set_idx
  on public.user_growth_tasks (task_set_id, order_index);

alter table public.user_growth_task_sets enable row level security;
alter table public.user_growth_tasks enable row level security;

create policy "Users can view own growth task sets"
  on public.user_growth_task_sets
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own growth task sets"
  on public.user_growth_task_sets
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own growth tasks"
  on public.user_growth_tasks
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own growth tasks"
  on public.user_growth_tasks
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own growth tasks"
  on public.user_growth_tasks
  for update
  using (auth.uid() = user_id);
