-- Hardening from code review. Earlier migrations are already applied to the
-- hosted project, so these are corrections rather than edits in place.

-- ---------------------------------------------------------------------------
-- Audit trigger: two defects.
--
-- 1. `current_setting('app.actor_id')::uuid` throws on a malformed value. This
--    trigger runs on EVERY audited mutation, so one bad setting would fail all
--    writes org-wide. Validate the shape before casting.
-- 2. `org_members` has a composite primary key and no `id` column, so its audit
--    rows recorded record_id = NULL — you could see that a membership changed
--    but not which one. Build a composite key for such tables.
-- ---------------------------------------------------------------------------
create or replace function app.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid;
  v_setting text;
  v_org     uuid;
  v_row     jsonb;
  v_rec     text;
begin
  v_setting := nullif(current_setting('app.actor_id', true), '');
  if v_setting is not null
     and v_setting ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    v_actor := v_setting::uuid;
  end if;
  v_actor := coalesce(auth.uid(), v_actor);

  v_row := case tg_op when 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  v_org := nullif(
    coalesce(
      v_row ->> 'org_id',
      case when tg_table_name = 'orgs' then v_row ->> 'id' end
    ),
    ''
  )::uuid;

  -- Tables with a composite primary key have no single `id` to record.
  v_rec := coalesce(
    v_row ->> 'id',
    case
      when tg_table_name = 'org_members'
        then (v_row ->> 'org_id') || ':' || (v_row ->> 'user_id')
      when tg_table_name = 'reminder_recipients'
        then (v_row ->> 'reminder_id') || ':' || (v_row ->> 'contact_id')
    end
  );

  insert into public.audit_log (org_id, actor_id, table_name, record_id, op, before, after)
  values (
    v_org, v_actor, tg_table_schema || '.' || tg_table_name, v_rec, tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilege escalation: the previous `for all` policy let any admin UPDATE any
-- org_members row in their org — including promoting themselves to owner, or
-- deleting the owner outright. Split it so admins can manage members but
-- neither grant ownership nor touch an owner's row.
-- ---------------------------------------------------------------------------
drop policy if exists org_members_write_admin on public.org_members;

create policy org_members_write_owner on public.org_members
  for all to authenticated
  using (app.has_org_role(org_id, array['owner']::public.org_role[]))
  with check (app.has_org_role(org_id, array['owner']::public.org_role[]));

-- `using` constrains the row being acted on; `with check` the resulting row.
-- Both exclude 'owner', so an admin can neither target an owner nor create one.
create policy org_members_insert_admin on public.org_members
  for insert to authenticated
  with check (
    app.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner'
  );

create policy org_members_update_admin on public.org_members
  for update to authenticated
  using (
    app.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner'
  )
  with check (
    app.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner'
  );

create policy org_members_delete_admin on public.org_members
  for delete to authenticated
  using (
    app.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner'
  );

-- ---------------------------------------------------------------------------
-- waitlist accepts anonymous INSERT, so unbounded text is a storage vector.
-- The zod schema already caps these; the database should not rely on it.
-- ---------------------------------------------------------------------------
alter table public.waitlist
  add constraint waitlist_email_length check (length(email) <= 254),
  add constraint waitlist_source_length check (source is null or length(source) <= 64);

-- ---------------------------------------------------------------------------
-- Currency must be an uppercase ISO-4217 code. char(3) alone would accept
-- 'inr', which would then group separately from 'INR' in v_account_balances —
-- silently splitting one account's balance across two rows.
-- ---------------------------------------------------------------------------
alter table public.accounts
  add constraint accounts_currency_iso4217 check (default_currency ~ '^[A-Z]{3}$');
alter table public.invoices
  add constraint invoices_currency_iso4217 check (currency ~ '^[A-Z]{3}$');
alter table public.payments
  add constraint payments_currency_iso4217 check (currency ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- "email is not null or phone is not null" is satisfied by an empty string, so
-- a contact could exist with no way to reach them — and still satisfy the P0
-- chase gate.
-- ---------------------------------------------------------------------------
alter table public.contacts drop constraint if exists contacts_reachable;
alter table public.contacts add constraint contacts_reachable check (
  btrim(coalesce(email, '')) <> '' or btrim(coalesce(phone, '')) <> ''
);

-- ---------------------------------------------------------------------------
-- A written-off invoice is one the business has stopped expecting to collect.
-- Counting it in outstanding_amount / overdue_amount overstates collectible
-- money, which is the whole point of these two numbers.
-- ---------------------------------------------------------------------------
create or replace view public.v_invoice_aging with (security_invoker = true) as
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
where i.status not in ('void', 'draft', 'written_off');
