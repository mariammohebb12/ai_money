-- Per-category monthly spending limits, so Analytics can show progress
-- toward a budget and flag categories that are close to or over it. Same
-- per-user RLS pattern as bills/saving_goals/transactions.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  monthly_limit numeric not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

alter table public.budgets enable row level security;

create policy "Users can view their own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can insert their own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.budgets to authenticated;

do $$
begin
  if not has_table_privilege('authenticated', 'public.budgets', 'SELECT') then
    raise exception 'authenticated role is missing SELECT on public.budgets';
  end if;
end $$;
