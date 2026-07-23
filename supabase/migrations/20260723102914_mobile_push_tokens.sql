create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android','ios')),
  status text not null default 'active' check (status in ('active','disabled','failed')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mobile_push_tokens enable row level security;
create policy "Users read own mobile push tokens" on public.mobile_push_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own mobile push tokens" on public.mobile_push_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own mobile push tokens" on public.mobile_push_tokens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own mobile push tokens" on public.mobile_push_tokens for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.mobile_push_tokens to authenticated;
