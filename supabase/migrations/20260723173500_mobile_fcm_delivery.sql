alter table public.mobile_push_tokens
  add column if not exists native_push_token text,
  add column if not exists provider text;

create unique index if not exists mobile_push_tokens_native_token_key
  on public.mobile_push_tokens (native_push_token)
  where native_push_token is not null;

create table if not exists public.mobile_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token_id uuid not null references public.mobile_push_tokens(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, token_id)
);

alter table public.mobile_notification_deliveries enable row level security;
revoke all privileges on table public.mobile_notification_deliveries from anon, authenticated;

create or replace function public.get_pending_mobile_push_notifications(
  p_server_secret text,
  p_limit integer default 25
)
returns table(
  delivery_id uuid,
  notification_id uuid,
  token_id uuid,
  native_push_token text,
  title text,
  body text,
  notification_type text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_server_secret(p_server_secret);

  insert into public.mobile_notification_deliveries (notification_id, token_id)
  select n.id, mt.id
  from public.notifications n
  join public.notification_preferences pref on pref.user_id = n.user_id
  join public.mobile_push_tokens mt on mt.user_id = n.user_id and mt.status = 'active'
  where n.read_at is null
    and mt.native_push_token is not null
    and coalesce(pref.push_enabled, false) = true
    and (
      (n.type ilike '%bid%' and coalesce(pref.bid_updates, true))
      or (n.type ilike '%escrow%' and coalesce(pref.escrow_updates, true))
      or (n.type ilike '%delivery%' and coalesce(pref.delivery_updates, true))
      or n.type not ilike all(array['%bid%', '%escrow%', '%delivery%'])
    )
  on conflict (notification_id, token_id) do nothing;

  return query
  select d.id, n.id, mt.id, mt.native_push_token, n.title, n.body, n.type
  from public.mobile_notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  join public.mobile_push_tokens mt on mt.id = d.token_id
  where d.status = 'queued' and mt.status = 'active' and mt.native_push_token is not null
  order by d.created_at asc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

create or replace function public.update_mobile_push_delivery_status(
  p_server_secret text,
  p_delivery_id uuid,
  p_token_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_server_secret(p_server_secret);
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'Unsupported mobile push delivery status';
  end if;

  update public.mobile_notification_deliveries
  set status = p_status,
      provider_message_id = p_provider_message_id,
      failure_reason = p_failure_reason,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      updated_at = now()
  where id = p_delivery_id;

  if p_status = 'failed' and (
    coalesce(p_failure_reason, '') ilike '%unregistered%'
    or coalesce(p_failure_reason, '') ilike '%not found%'
    or coalesce(p_failure_reason, '') ilike '%invalid registration%'
  ) then
    update public.mobile_push_tokens
    set status = 'failed', updated_at = now()
    where id = p_token_id;
  else
    update public.mobile_push_tokens
    set last_seen_at = now(), updated_at = now()
    where id = p_token_id;
  end if;
end;
$$;

revoke all on function public.get_pending_mobile_push_notifications(text, integer) from public, anon, authenticated;
revoke all on function public.update_mobile_push_delivery_status(text, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.get_pending_mobile_push_notifications(text, integer) to service_role;
grant execute on function public.update_mobile_push_delivery_status(text, uuid, uuid, text, text, text) to service_role;
