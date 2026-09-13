-- Make the signup trigger idempotent: a retried signup (or any future path
-- that re-fires this trigger for an id that already has a profile) should
-- never fail the whole auth.users insert over a duplicate-row conflict.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
