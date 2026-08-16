-- Derived numbers: aging, outstanding, overdue.
--
-- `security_invoker = true` is not optional. Without it a view runs with its
-- owner's privileges and quietly bypasses the RLS on its base tables, which
-- would turn every one of these into a cross-tenant data leak.

-- ---------------------------------------------------------------------------
-- Domain rule: "Aging never resets on partial payment."
--
-- Expressed mechanically: days_overdue derives from due_date and nothing else.
-- A partial payment moves `balance`; there is no path by which it can touch
-- `days_overdue`. Storing the aging on the row and recomputing it on payment
-- is precisely the bug this shape makes unrepresentable.
-- ---------------------------------------------------------------------------
create view public.v_invoice_aging with (security_invoker = true) as
select
  i.id         as invoice_id,
  i.org_id,
  i.account_id,
  i.invoice_number,
  i.currency,
  i.status,
  i.issue_date,
  i.due_date,
  i.amount,
  coalesce(p.paid, 0)::numeric(15, 2) as amount_paid,
  (i.amount - coalesce(p.paid, 0))::numeric(15, 2) as balance,
  greatest(0, current_date - i.due_date) as days_overdue,
  (i.due_date < current_date and i.amount - coalesce(p.paid, 0) > 0) as is_overdue
from public.invoices i
left join (
  select invoice_id, sum(amount) as paid
  from public.payments
  group by invoice_id
) p on p.invoice_id = i.id
where i.status not in ('void', 'draft');

comment on view public.v_invoice_aging is
  'Per-invoice balance and aging. days_overdue is a function of due_date alone, '
  'so a partial payment never resets it.';

-- ---------------------------------------------------------------------------
-- Domain rule: "Outstanding and overdue are always shown as separate numbers.
-- Never merge."
--
-- They are two columns here and there is no third column combining them.
-- Grouping includes `currency` because project.mdc forbids assuming a single
-- currency — summing across currencies would be meaningless arithmetic.
-- ---------------------------------------------------------------------------
create view public.v_account_balances with (security_invoker = true) as
select
  a.org_id,
  a.id   as account_id,
  a.name as account_name,
  v.currency,
  coalesce(sum(v.balance) filter (where v.balance > 0), 0)::numeric(15, 2) as outstanding_amount,
  coalesce(sum(v.balance) filter (where v.is_overdue), 0)::numeric(15, 2)  as overdue_amount,
  count(*) filter (where v.balance > 0) as outstanding_count,
  count(*) filter (where v.is_overdue)  as overdue_count,
  max(v.days_overdue) filter (where v.is_overdue) as max_days_overdue
from public.accounts a
join public.v_invoice_aging v on v.account_id = a.id
group by a.org_id, a.id, a.name, v.currency;

comment on view public.v_account_balances is
  'Per-account, per-currency rollup. outstanding_amount and overdue_amount are '
  'deliberately separate and are never summed together or across currencies.';
