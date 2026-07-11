alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles add constraint profiles_role_check
check (role = any (array['buyer'::text, 'seller'::text, 'agent'::text, 'business'::text, 'admin'::text, 'superadmin'::text]));

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'superadmin')
  );
$function$;

create or replace function public.prevent_profile_privilege_self_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  actor_role text;
begin
  if new.role not in ('buyer', 'seller', 'agent', 'business', 'admin', 'superadmin') then
    raise exception 'Unsupported profile role.';
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if old.id = (select auth.uid()) then
    actor_role := old.role;
  else
    select p.role into actor_role
    from public.profiles p
    where p.id = (select auth.uid());
  end if;

  if old.role is distinct from new.role
    and (
      old.role in ('admin', 'superadmin')
      or new.role in ('admin', 'superadmin')
    )
    and actor_role is distinct from 'superadmin' then
    raise exception 'Only superadmins can grant or remove admin access.';
  end if;

  if (old.account_status is distinct from new.account_status
    or old.suspension_reason is distinct from new.suspension_reason
    or old.suspended_at is distinct from new.suspended_at
    or old.suspended_by is distinct from new.suspended_by)
    and actor_role not in ('admin', 'superadmin') then
    raise exception 'Only admins can change moderation status.';
  end if;

  return new;
end;
$function$;

update public.profiles p
set role = 'superadmin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'ngbridz@gmail.com';
