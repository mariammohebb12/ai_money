-- Adds recurring-bill support: a bill can repeat on a fixed interval, so
-- marking it paid can spawn the next occurrence with the due date advanced.
alter table public.bills
  add column repeat_interval text not null default 'none';

alter table public.bills
  add constraint bills_repeat_interval_check
  check (repeat_interval in ('none', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'yearly'));
