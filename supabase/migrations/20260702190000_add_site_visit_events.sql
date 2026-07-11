create table if not exists public.site_visit_events (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now(),
  path text not null,
  referrer text,
  user_id uuid references auth.users(id) on delete set null,
  visitor_key text,
  ip_hash text,
  user_agent text,
  device_type text not null default 'desktop',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists site_visit_events_visited_at_idx on public.site_visit_events (visited_at desc);
create index if not exists site_visit_events_path_idx on public.site_visit_events (path);
create index if not exists site_visit_events_user_id_idx on public.site_visit_events (user_id);
create index if not exists site_visit_events_visitor_key_idx on public.site_visit_events (visitor_key);

alter table public.site_visit_events enable row level security;

revoke all on table public.site_visit_events from anon;
revoke all on table public.site_visit_events from authenticated;
grant select on table public.site_visit_events to authenticated;

drop policy if exists "admins read site visit events" on public.site_visit_events;
create policy "admins read site visit events"
on public.site_visit_events
for select
to authenticated
using (current_user_is_admin());
