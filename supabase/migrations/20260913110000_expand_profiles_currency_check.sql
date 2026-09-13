-- The currency picker UI (src/lib/currency.ts CURRENCY_OPTIONS) was expanded
-- to 10 currencies, but this check constraint was never updated to match,
-- so saving anything past USD/EUR/GBP was rejected by the database.
--
-- Drop whatever the auto-generated check constraint on profiles.currency is
-- actually named (Postgres names it "profiles_currency_check", not
-- "profile_currency_check") rather than hardcoding a guessed name.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%currency%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_currency_check
  check (currency in ('USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR', 'CAD', 'AUD', 'JPY', 'INR'));
