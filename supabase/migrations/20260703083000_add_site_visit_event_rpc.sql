create or replace function public.record_site_visit_event(
  p_server_secret text,
  p_path text,
  p_referrer text default null,
  p_user_id uuid default null,
  p_visitor_key text default null,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_device_type text default 'desktop',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_device_type text;
begin
  perform public.assert_server_secret(p_server_secret);

  if nullif(trim(p_path), '') is null then
    raise exception 'Visit path is required.';
  end if;

  v_device_type := case
    when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type
    else 'desktop'
  end;

  insert into public.site_visit_events (
    path,
    referrer,
    user_id,
    visitor_key,
    ip_hash,
    user_agent,
    device_type,
    metadata
  )
  values (
    left(p_path, 500),
    left(p_referrer, 500),
    p_user_id,
    left(p_visitor_key, 100),
    p_ip_hash,
    left(p_user_agent, 500),
    v_device_type,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.record_site_visit_event(text, text, text, uuid, text, text, text, text, jsonb) to anon;
grant execute on function public.record_site_visit_event(text, text, text, uuid, text, text, text, text, jsonb) to authenticated;
