create table if not exists public.competitor_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists competitor_channels_user_id_idx
  on public.competitor_channels (user_id);

alter table public.competitor_channels enable row level security;

create policy "Users can view own competitor channels"
  on public.competitor_channels
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own competitor channels"
  on public.competitor_channels
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own competitor channels"
  on public.competitor_channels
  for delete
  using (auth.uid() = user_id);
