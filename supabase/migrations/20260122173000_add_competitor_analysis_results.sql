create table if not exists public.competitor_analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competitor_channel_url text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists competitor_analysis_results_user_id_idx
  on public.competitor_analysis_results (user_id, created_at desc);

alter table public.competitor_analysis_results enable row level security;

create policy "Users can view own competitor analyses"
  on public.competitor_analysis_results
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own competitor analyses"
  on public.competitor_analysis_results
  for insert
  with check (auth.uid() = user_id);
