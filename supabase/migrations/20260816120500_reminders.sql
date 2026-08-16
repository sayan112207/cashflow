-- Reminders: the chase cadence, its tone escalation, and the event log.

create type public.reminder_tone   as enum ('gentle', 'standard', 'firm');
create type public.reminder_status as enum ('scheduled', 'sent', 'failed', 'cancelled');

-- The `reminders` and `reminder_events` foreign keys below both target
-- invoices (id, org_id). A composite FK needs a unique constraint matching its
-- referenced columns *exactly*: the existing (id, org_id, currency) key on
-- invoices — which exists so the payments FK can enforce currency agreement —
-- does not satisfy a two-column reference.
alter table public.invoices add constraint invoices_id_org_key unique (id, org_id);

create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  invoice_id    uuid not null,
  step          smallint not null check (step >= 1),
  channel       public.contact_channel not null,
  tone          public.reminder_tone not null,
  scheduled_for date not null,
  status        public.reminder_status not null default 'scheduled',
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint reminders_invoice_fk foreign key (invoice_id, org_id)
    references public.invoices (id, org_id) on delete cascade
);

create unique index reminders_invoice_step_uniq on public.reminders (invoice_id, step);
create index reminders_due_idx on public.reminders (org_id, scheduled_for) where status = 'scheduled';

alter table public.reminders add constraint reminders_id_org_key unique (id, org_id);

-- Domain rule: "Escalation is cumulative, not a handoff — P0 stays in the
-- thread when P1 joins." Modelling recipients as a set per reminder is what
-- makes that representable at all; a single `contact_id` column would force a
-- handoff by construction.
create table public.reminder_recipients (
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  contact_id  uuid not null references public.contacts (id) on delete restrict,
  primary key (reminder_id, contact_id)
);

create table public.reminder_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  invoice_id  uuid not null,
  reminder_id uuid references public.reminders (id) on delete set null,
  kind        text not null check (kind in (
    'invoice_sent', 'reminder_scheduled', 'email_sent', 'whatsapp_sent',
    'sms_sent', 'payment_link_opened', 'payment_received'
  )),
  occurred_at timestamptz not null default now(),
  detail      jsonb,
  constraint reminder_events_invoice_fk foreign key (invoice_id, org_id)
    references public.invoices (id, org_id) on delete cascade
);

create index reminder_events_invoice_idx on public.reminder_events (invoice_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Scheduling a chase.
--
-- An RPC rather than a sequence of supabase-js calls: PostgREST gives each call
-- its own transaction, so the gate check, the insert, the recipient fan-out and
-- the event row could not otherwise be made atomic.
--
-- Enforces three domain rules at once:
--   1. the account must have an active P0 before it can be chased
--   2. tone may escalate but never de-escalate
--   3. recipients are cumulative — P0 stays in the thread as P1 and P2 join
-- ---------------------------------------------------------------------------
create or replace function public.schedule_reminder(
  p_invoice_id    uuid,
  p_channel       public.contact_channel,
  p_tone          public.reminder_tone,
  p_scheduled_for date default current_date
)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       uuid;
  v_account   uuid;
  v_step      smallint;
  v_prev_tone public.reminder_tone;
  v_reminder  public.reminders;
  v_ceiling   public.contact_priority;
begin
  select i.org_id, i.account_id into v_org, v_account
  from public.invoices i
  where i.id = p_invoice_id;

  if v_org is null then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  -- definer functions bypass RLS, so authorise explicitly
  if not app.is_org_member(v_org) then
    raise exception 'not a member of this organisation' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.contacts c
    where c.account_id = v_account and c.priority = 'P0' and c.is_active
  ) then
    raise exception 'account has no active P0 contact and cannot be chased'
      using errcode = 'P0001';
  end if;

  select coalesce(max(r.step), 0) + 1 into v_step
  from public.reminders r
  where r.invoice_id = p_invoice_id;

  select r.tone into v_prev_tone
  from public.reminders r
  where r.invoice_id = p_invoice_id
  order by r.step desc
  limit 1;

  -- enum declaration order is the escalation order
  if v_prev_tone is not null and p_tone < v_prev_tone then
    raise exception 'tone cannot de-escalate (% -> %)', v_prev_tone, p_tone
      using errcode = 'P0001';
  end if;

  insert into public.reminders (org_id, invoice_id, step, channel, tone, scheduled_for)
  values (v_org, p_invoice_id, v_step, p_channel, p_tone, p_scheduled_for)
  returning * into v_reminder;

  v_ceiling := case
    when v_step >= 3 then 'P2'
    when v_step = 2  then 'P1'
    else 'P0'
  end::public.contact_priority;

  insert into public.reminder_recipients (reminder_id, contact_id)
  select v_reminder.id, c.id
  from public.contacts c
  where c.account_id = v_account
    and c.is_active
    and c.priority <= v_ceiling;   -- cumulative: P0 <= P1 <= P2

  insert into public.reminder_events (org_id, invoice_id, reminder_id, kind)
  values (v_org, p_invoice_id, v_reminder.id, 'reminder_scheduled');

  return v_reminder;
end;
$$;

revoke execute on function public.schedule_reminder(uuid, public.contact_channel, public.reminder_tone, date) from public, anon;
grant execute on function public.schedule_reminder(uuid, public.contact_channel, public.reminder_tone, date) to authenticated;

-- ---------------------------------------------------------------------------
-- The other half of "exactly one P0": you may not remove or deactivate the
-- last active P0 while that account still has scheduled chases.
-- ---------------------------------------------------------------------------
create or replace function app.tg_protect_last_p0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- only relevant when a row stops being an active P0
  if old.priority <> 'P0' or not old.is_active then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' and new.priority = 'P0' and new.is_active then
    return new;
  end if;

  if exists (
    select 1
    from public.reminders r
    join public.invoices i on i.id = r.invoice_id
    where i.account_id = old.account_id
      and r.status = 'scheduled'
  ) then
    raise exception
      'cannot remove the last active P0 contact while chases are scheduled'
      using errcode = 'P0001';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger contacts_protect_last_p0
  before update or delete on public.contacts
  for each row execute function app.tg_protect_last_p0();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.reminders            enable row level security;
alter table public.reminder_recipients  enable row level security;
alter table public.reminder_events      enable row level security;

create policy reminders_rw_member on public.reminders
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

create policy reminder_events_rw_member on public.reminder_events
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

-- reminder_recipients has no org_id of its own; scope it through its parent.
create policy reminder_recipients_rw_member on public.reminder_recipients
  for all to authenticated
  using (
    exists (
      select 1 from public.reminders r
      where r.id = reminder_id and app.is_org_member(r.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.reminders r
      where r.id = reminder_id and app.is_org_member(r.org_id)
    )
  );

create trigger reminders_audit
  after insert or update or delete on public.reminders
  for each row execute function app.tg_audit();
