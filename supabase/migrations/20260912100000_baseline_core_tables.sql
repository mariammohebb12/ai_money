-- Baseline for the app's four core tables — transactions, categories,
-- saving_goals, and bills. These were originally created directly in the
-- Supabase SQL Editor, before this project adopted migration files, so
-- there was never a `create table` for them in git — only later `alter
-- table` migrations layered on top of a schema git couldn't see.
--
-- This file was reverse-engineered from the live production schema (columns,
-- constraints, indexes, RLS policies, and grants queried directly via
-- `supabase db query --linked` against information_schema/pg_catalog) so
-- that the full table structure is finally recorded in git and this project
-- could be rebuilt from scratch if the live database were ever lost.
--
-- It is timestamped earlier than every existing migration so a fresh
-- `supabase db reset` replays it first, then applies the later
-- `add_bills_repeat_interval` and `add_saving_goals_icon` migrations on top —
-- exactly reproducing today's live schema. It was never executed against the
-- live project (the tables already exist there); it was registered as
-- already-applied via `supabase migration repair 20260912100000 --status
-- applied --linked` so future `db push` runs don't try to re-create it.
--
-- Known warts intentionally preserved as-is, not "fixed" here, since this
-- migration's job is to document reality, not change it:
--   - `saving_goals` has two near-duplicate sets of CRUD policies ("saving
--     goals" vs "savings goals" naming) — both exist live, both are captured
--     below.
--   - `transactions.type` has no CHECK constraint restricting it to
--     'income'/'expense' — that's enforced only in application code
--     (src/app/add-transaction.tsx), not the database.
--   - No indexes exist beyond each table's primary key — e.g. nothing on
--     transactions.user_id or transactions.transaction_date, despite every
--     query filtering/sorting on them.

-- ---------------------------------------------------------------------------
-- categories — a shared reference table (no user_id): every user reads the
-- same rows, none of them can write to it.
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color text not null
);

alter table public.categories enable row level security;

create policy "Anyone can view categories"
  on public.categories for select
  using (true);

grant select on public.categories to anon, authenticated;

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  type text not null,
  merchant text,
  note text,
  created_at timestamptz not null default now(),
  category_id uuid references public.categories (id),
  transaction_date date not null default current_date
);

alter table public.transactions enable row level security;

create policy "Users can view their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- saving_goals
-- (icon column added later by 20260913120000_add_saving_goals_icon.sql)
-- ---------------------------------------------------------------------------
create table public.saving_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  target_date date
);

alter table public.saving_goals enable row level security;

-- Duplicate policy pairs below ("saving goals" / "savings goals") are not a
-- typo in this file — both exist on the live table and are reproduced as-is.
create policy "Users can view their own saving goals"
  on public.saving_goals for select
  using (auth.uid() = user_id);

create policy "Users can view their own savings goals"
  on public.saving_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saving goals"
  on public.saving_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can insert their own savings goals"
  on public.saving_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saving goals"
  on public.saving_goals for update
  using (auth.uid() = user_id);

create policy "Users can update their own savings goals"
  on public.saving_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own saving goals"
  on public.saving_goals for delete
  using (auth.uid() = user_id);

create policy "Users can delete their own savings goals"
  on public.saving_goals for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saving_goals to authenticated;

-- ---------------------------------------------------------------------------
-- bills
-- (repeat_interval column + check added later by
-- 20260912120000_add_bills_repeat_interval.sql)
-- ---------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric not null,
  due_date date not null,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bills enable row level security;

create policy "Users can view their own bills"
  on public.bills for select
  using (auth.uid() = user_id);

create policy "Users can insert their own bills"
  on public.bills for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own bills"
  on public.bills for update
  using (auth.uid() = user_id);

create policy "Users can delete their own bills"
  on public.bills for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.bills to authenticated;

-- Fail loudly (not silently) if any of the above didn't take, so a future
-- `db reset` replay that silently drifts from production gets caught here
-- rather than surfacing later as a confusing "permission denied" in the app.
do $$
begin
  if not has_table_privilege('authenticated', 'public.transactions', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.transactions';
  end if;
  if not has_table_privilege('authenticated', 'public.saving_goals', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.saving_goals';
  end if;
  if not has_table_privilege('authenticated', 'public.bills', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.bills';
  end if;
  if not has_table_privilege('authenticated', 'public.categories', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.categories';
  end if;
end $$;
