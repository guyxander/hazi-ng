alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = lower(u.email),
    updated_at = now()
from auth.users u
where p.id = u.id
  and u.email is not null
  and p.email is distinct from lower(u.email);

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles
  set email = lower(new.email),
      updated_at = now()
  where id = new.id
    and new.email is not null;

  return new;
end;
$$;

drop trigger if exists sync_profile_email_from_auth on auth.users;

create trigger sync_profile_email_from_auth
after insert or update of email on auth.users
for each row
execute function public.sync_profile_email_from_auth();
