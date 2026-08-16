-- Invoices and payments — the core of the collections model.

create type public.invoice_status as enum (
  'draft', 'open', 'partially_paid', 'paid', 'void', 'written_off'
);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  account_id     uuid not null,
  invoice_number text not null check (btrim(invoice_number) <> ''),
  invoice_number_normalized text
    generated always as (app.normalize_invoice_number(invoice_number)) stored,

  -- project.mdc: "Amounts are numeric(15,2), never float."
  amount   numeric(15, 2) not null check (amount > 0),
  -- ...and "never assume single currency", so it lives per invoice.
  currency char(3) not null default 'INR',

  -- project.mdc: "Dates are `date`, never timestamp. Due dates have no time
  -- component and timezone conversion silently shifts them by a day."
  issue_date date not null default current_date,
  due_date   date not null,

  status       public.invoice_status not null default 'open',
  external_ref text,                       -- id in Tally / Zoho
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- `restrict`, not `cascade`: deleting an account must not silently erase its
  -- collections history. Retiring an invoice is a status change ('void' /
  -- 'written_off'), which is why the UI needs an archive action, not a delete
  -- button.
  constraint invoices_account_fk foreign key (account_id, org_id)
    references public.accounts (id, org_id) on delete restrict,
  constraint invoices_due_after_issue check (due_date >= issue_date)
);

-- Domain rule: "Unique constraint: (orgId, accountId, invoiceNumberNormalized)."
create unique index invoices_org_account_number_uniq
  on public.invoices (org_id, account_id, invoice_number_normalized);

create index invoices_org_due_idx on public.invoices (org_id, due_date);
create index invoices_account_idx on public.invoices (account_id);

-- Target for the payments FK below. Including `currency` means the foreign key
-- itself guarantees a payment is denominated in its invoice's currency — no
-- trigger needed.
alter table public.invoices
  add constraint invoices_id_org_currency_key unique (id, org_id, currency);

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  invoice_id uuid not null,
  -- Partial payments are first-class: several rows may point at one invoice.
  amount     numeric(15, 2) not null check (amount > 0),
  currency   char(3) not null,
  paid_on    date not null default current_date,
  method     text,
  reference  text,
  created_at timestamptz not null default now(),
  constraint payments_invoice_fk foreign key (invoice_id, org_id, currency)
    references public.invoices (id, org_id, currency) on delete restrict
);

create index payments_invoice_idx on public.payments (invoice_id);
create index payments_org_paid_on_idx on public.payments (org_id, paid_on);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

create policy invoices_rw_member on public.invoices
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

create policy payments_rw_member on public.payments
  for all to authenticated
  using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger invoices_touch_updated_at
  before update on public.invoices
  for each row execute function app.tg_touch_updated_at();

create trigger invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function app.tg_audit();

create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function app.tg_audit();
