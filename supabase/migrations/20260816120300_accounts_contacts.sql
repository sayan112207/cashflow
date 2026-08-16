-- Accounts (the customers who owe money) and their contacts.

create type public.contact_priority as enum ('P0', 'P1', 'P2');
create type public.contact_channel  as enum ('email', 'whatsapp', 'sms');

-- Enum comparison follows declaration order, so P0 < P1 < P2. The cumulative
-- escalation query in the reminders migration relies on that ordering.

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs (id) on delete cascade,
  name            text not null check (btrim(name) <> ''),
  name_normalized text generated always as (app.normalize_account_name(name)) stored,
  default_currency char(3) not null default 'INR',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Duplicate detection across imports: "Northline Creative Pvt Ltd" and
-- "Northline Creative" are the same debtor.
create unique index accounts_org_name_uniq on public.accounts (org_id, name_normalized);
create index accounts_org_idx on public.accounts (org_id);

-- Redundant against the primary key, but required as the target of the
-- composite foreign keys below, which stop a child row in org A from pointing
-- at a parent in org B. RLS scopes reads; this scopes referential integrity.
alter table public.accounts add constraint accounts_id_org_key unique (id, org_id);

create table public.contacts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs (id) on delete cascade,
  account_id        uuid not null,
  name              text not null check (btrim(name) <> ''),
  email             text,
  phone             text,
  priority          public.contact_priority not null default 'P1',
  preferred_channel public.contact_channel,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contacts_account_fk foreign key (account_id, org_id)
    references public.accounts (id, org_id) on delete cascade,
  -- there is no point in a contact we cannot reach
  constraint contacts_reachable check (email is not null or phone is not null)
);

create index contacts_account_idx on public.contacts (account_id);

-- ---------------------------------------------------------------------------
-- Domain rule: "An account needs exactly one P0 contact before it can be
-- chased. P1 and P2 are optional."
--
-- The rule splits into two halves needing different mechanisms:
--
--   at-most-one  -> this partial unique index. Exact, always enforced, cheap.
--   at-least-one -> a cross-row assertion, which no constraint can express.
--                   Read literally, the rule makes it a precondition of
--                   *chasing*, not of the account existing — so it is enforced
--                   at the chase gate inside public.schedule_reminder(), plus a
--                   trigger that blocks removing the last active P0 while
--                   reminders are still scheduled.
--
-- Tradeoff: an account may sit P0-less indefinitely. It simply cannot be
-- chased, which is exactly what the rule says. The alternative — demanding a
-- P0 at insert time — would make contact imports order-dependent.
-- ---------------------------------------------------------------------------
create unique index contacts_one_active_p0_per_account
  on public.contacts (account_id)
  where priority = 'P0' and is_active;

alter table public.contacts add constraint contacts_id_org_key unique (id, org_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;

create policy accounts_rw_member on public.accounts
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

create policy contacts_rw_member on public.contacts
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row execute function app.tg_touch_updated_at();

create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function app.tg_touch_updated_at();

create trigger accounts_audit
  after insert or update or delete on public.accounts
  for each row execute function app.tg_audit();

create trigger contacts_audit
  after insert or update or delete on public.contacts
  for each row execute function app.tg_audit();
