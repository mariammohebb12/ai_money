-- Each section below is isolated in its own DO block with exception handling,
-- so a failure in one section (e.g. bills hitting an unknown check constraint)
-- can't silently roll back the others. Check the "Messages"/"Logs" pane in the
-- SQL editor after running — each section reports how many rows it inserted,
-- or the exact error if it failed.

-- 1. ~50 expense transactions over the last 8 weeks.
-- Weekend bias (+45%) and a slight recent-weeks uptrend (+22% by today) are
-- applied live via extract(dow from ...) and days_ago, so the pattern is
-- genuinely correct regardless of what day you actually run this on.
-- Tagged note='seed-demo' so the companion delete script can remove exactly
-- these rows later, without guessing by merchant/amount.
do $$
declare
  affected int;
begin
  insert into public.transactions (user_id, amount, type, category_id, merchant, note, transaction_date)
  select
    'e5546426-d3d5-4b10-8ea7-524ff8816d37',
    round(
      v.base_amount
      * (case when extract(dow from (current_date - v.days_ago)) in (0, 6) then 1.45 else 1.0 end)
      * (1 + ((55 - v.days_ago) / 55.0) * 0.22)
    , 2),
    'expense',
    c.id,
    v.merchant,
    'seed-demo',
    (current_date - v.days_ago)
  from (values
    -- Week 0 (last 7 days) — extra rows here so Home's insight has enough recent data
    (0, 'Food', 'Trader Joe''s', 54.10),
    (1, 'Transport', 'Uber', 14.50),
    (2, 'Food', 'Starbucks', 6.85),
    (3, 'Entertainment', 'Netflix', 15.99),
    (4, 'Shopping', 'Target', 47.20),
    (5, 'Food', 'Chipotle', 13.40),
    (6, 'Food', 'Farmers Market', 38.60),
    (6, 'Entertainment', 'AMC Theatres', 32.00),
    -- Week 1
    (7, 'Transport', 'Shell Gas Station', 42.00),
    (8, 'Food', 'Whole Foods Market', 68.30),
    (9, 'Shopping', 'Amazon', 29.99),
    (10, 'Health', 'CVS Pharmacy', 18.75),
    (11, 'Food', 'Starbucks', 5.95),
    (13, 'Bills', 'Spotify', 10.99),
    -- Week 2
    (14, 'Food', 'Chipotle', 15.20),
    (15, 'Transport', 'Uber', 11.30),
    (16, 'Shopping', 'H&M', 63.50),
    (17, 'Food', 'Trader Joe''s', 49.80),
    (19, 'Entertainment', 'Regal Cinemas', 24.00),
    (20, 'Food', 'Local Diner', 22.15),
    -- Week 3
    (21, 'Health', 'Planet Fitness', 29.99),
    (22, 'Food', 'Starbucks', 6.40),
    (23, 'Transport', 'Metro Transit Pass', 55.00),
    (24, 'Shopping', 'Amazon', 41.60),
    (26, 'Food', 'Whole Foods Market', 57.90),
    (27, 'Bills', 'Internet - Xfinity', 65.00),
    -- Week 4
    (28, 'Food', 'Chipotle', 12.85),
    (29, 'Entertainment', 'Spotify', 10.99),
    (30, 'Transport', 'Shell Gas Station', 38.50),
    (31, 'Food', 'Farmers Market', 33.20),
    (33, 'Education', 'Coursera', 49.00),
    (34, 'Health', 'CVS Pharmacy', 22.40),
    -- Week 5
    (35, 'Food', 'Starbucks', 5.75),
    (36, 'Shopping', 'Target', 35.90),
    (37, 'Transport', 'Uber', 9.80),
    (38, 'Food', 'Trader Joe''s', 45.30),
    (40, 'Entertainment', 'AMC Theatres', 28.00),
    (41, 'Food', 'Local Diner', 19.60),
    -- Week 6
    (42, 'Health', 'Dr. Patel Copay', 35.00),
    (43, 'Food', 'Whole Foods Market', 52.75),
    (44, 'Transport', 'Metro Transit Pass', 55.00),
    (45, 'Shopping', 'Amazon', 24.99),
    (47, 'Bills', 'Phone - Verizon', 58.00),
    (48, 'Food', 'Chipotle', 11.90),
    -- Week 7 (oldest)
    (49, 'Food', 'Starbucks', 5.50),
    (50, 'Education', 'Udemy Course', 34.99),
    (51, 'Transport', 'Shell Gas Station', 36.00),
    (52, 'Food', 'Trader Joe''s', 41.20),
    (54, 'Entertainment', 'Netflix', 15.99),
    (55, 'Food', 'Farmers Market', 29.80)
  ) as v(days_ago, category, merchant, base_amount)
  join public.categories c on c.name = v.category;

  get diagnostics affected = row_count;
  raise notice 'Section 1 (expense transactions): % rows inserted', affected;
exception when others then
  raise notice 'Section 1 (expense transactions) FAILED: %', sqlerrm;
end $$;

-- 2. Biweekly "salary" income deposits — same tag.
do $$
declare
  affected int;
begin
  insert into public.transactions (user_id, amount, type, category_id, merchant, note, transaction_date)
  select
    'e5546426-d3d5-4b10-8ea7-524ff8816d37',
    v.amount,
    'income',
    c.id,
    'Acme Corp Payroll',
    'seed-demo',
    (current_date - v.days_ago)
  from (values
    (3, 2150.00),
    (17, 2150.00),
    (31, 2150.00),
    (45, 2150.00)
  ) as v(days_ago, amount)
  join public.categories c on c.name = 'Income';

  get diagnostics affected = row_count;
  raise notice 'Section 2 (income transactions): % rows inserted', affected;
exception when others then
  raise notice 'Section 2 (income transactions) FAILED: %', sqlerrm;
end $$;

-- 3. Progressive-looking savings goal progress. No contribution-history table
-- exists (saving_goals only stores one current_amount), so this adds a
-- realistic, non-round total to your most recently created goal, capped at
-- its target so it never overshoots 100%.
do $$
declare
  affected int;
begin
  update public.saving_goals
  set current_amount = least(current_amount + 1247.65, target_amount)
  where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
    and id = (
      select id from public.saving_goals
      where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
      order by created_at desc
      limit 1
    );

  get diagnostics affected = row_count;
  if affected = 0 then
    raise notice 'Section 3 (savings goal): no goal found for this user — nothing updated';
  else
    raise notice 'Section 3 (savings goal): % row updated', affected;
  end if;
exception when others then
  raise notice 'Section 3 (savings goal) FAILED: %', sqlerrm;
end $$;

-- 4. Bills: one paid, one upcoming, one overdue.
do $$
declare
  affected int;
begin
  insert into public.bills (user_id, name, amount, due_date, is_paid) values
    ('e5546426-d3d5-4b10-8ea7-524ff8816d37', 'Electric Bill', 84.50, current_date - 10, true),
    ('e5546426-d3d5-4b10-8ea7-524ff8816d37', 'Rent', 1250.00, current_date + 5, false),
    ('e5546426-d3d5-4b10-8ea7-524ff8816d37', 'Internet Service', 64.99, current_date - 4, false);

  get diagnostics affected = row_count;
  raise notice 'Section 4 (bills): % rows inserted', affected;
exception when others then
  raise notice 'Section 4 (bills) FAILED: %', sqlerrm;
end $$;

-- Verification — check this result set after running.
select
  (select count(*) from public.transactions where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37' and note = 'seed-demo') as seeded_transactions,
  (select count(*) from public.bills where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37' and name in ('Electric Bill', 'Rent', 'Internet Service')) as seeded_bills,
  (select current_amount from public.saving_goals where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37' order by created_at desc limit 1) as goal_current_amount;
