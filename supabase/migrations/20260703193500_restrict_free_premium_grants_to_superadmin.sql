create or replace function public.current_user_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'superadmin'
  );
$$;

drop policy if exists "admins insert premium subscriptions" on public.premium_subscriptions;
create policy "superadmins insert premium subscriptions"
on public.premium_subscriptions
for insert
to authenticated
with check (public.current_user_is_superadmin());

drop policy if exists "admins update premium subscriptions" on public.premium_subscriptions;
create policy "superadmins update premium subscriptions"
on public.premium_subscriptions
for update
to authenticated
using (public.current_user_is_superadmin())
with check (public.current_user_is_superadmin());
