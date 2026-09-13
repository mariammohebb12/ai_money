-- Creates the profiles row the moment an account is created, independent of
-- whether email confirmation is required (a client-side write right after
-- signUp() can't rely on having a session yet if it is). full_name is passed
-- in as auth signUp() metadata and lands in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
