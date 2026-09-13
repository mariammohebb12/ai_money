-- One row per user for app-level profile data (display name, financial
-- setup) that doesn't belong in auth identity data. Same per-user RLS
-- pattern as bills/saving_goals/transactions.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  monthly_income numeric not null default 0,
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);
