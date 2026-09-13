begin;

-- Transactions: precisely tagged, so this can't touch your real transactions.
delete from public.transactions
where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
  and note = 'seed-demo';

-- Bills: no tag column exists on this table, so this matches the exact
-- (name, amount) pairs the seed script inserted. Safe unless you've since
-- created a real bill with one of these exact same name+amount combos.
delete from public.bills
where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
  and (name, amount) in (
    ('Electric Bill', 84.50),
    ('Rent', 1250.00),
    ('Internet Service', 64.99)
  );

-- Savings goal: reverses the +1247.65 bump. NOTE: if the original update was
-- capped by `least(..., target_amount)` (i.e. you were already close to your
-- goal), this will subtract slightly more than was actually added, since the
-- exact capped amount isn't recorded anywhere. Check the resulting
-- current_amount looks right after running.
update public.saving_goals
set current_amount = greatest(current_amount - 1247.65, 0)
where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
  and id = (
    select id from public.saving_goals
    where user_id = 'e5546426-d3d5-4b10-8ea7-524ff8816d37'
    order by created_at desc
    limit 1
  );

commit;
