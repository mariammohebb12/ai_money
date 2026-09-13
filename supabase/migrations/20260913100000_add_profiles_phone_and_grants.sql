-- Adds an optional phone number to the profile.
alter table public.profiles
  add column phone text;

-- Explicit, idempotent grants: RLS policies only restrict access that the
-- underlying table grant already allows — a role with no GRANT on the table
-- gets "permission denied" before RLS is ever evaluated. Tables created via
-- CLI migration (as this one was) don't always inherit the authenticated/anon
-- grants the Dashboard table editor sets up automatically, which is what
-- caused the earlier notifications-toggle permission error. Re-asserting
-- this here keeps it captured in migration history instead of only living as
-- a manual fix in the live database.
grant select, insert, update on public.profiles to authenticated;

-- Fail loudly (not silently) if the grant somehow didn't take, so this stays
-- a real regression check rather than a no-op.
do $$
begin
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.profiles';
  end if;
  if not has_table_privilege('authenticated', 'public.profiles', 'INSERT') then
    raise exception 'authenticated role is missing INSERT on public.profiles';
  end if;
  if not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'authenticated role is missing UPDATE on public.profiles';
  end if;
end $$;
