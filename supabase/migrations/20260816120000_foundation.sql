-- Foundation: the private `app` helper schema, the domain normalizers, and the
-- audit machinery every other migration builds on.
--
-- Why a separate `app` schema: PostgREST only exposes the schemas it is
-- configured with (`public`, `graphql_public`). Helpers that live in `app` are
-- callable from RLS policies and generated columns but are not part of the HTTP
-- API surface.

create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Domain rule: invoice number normalization
--
-- "Invoice numbers normalize by trim, collapse whitespace, uppercase, strip
--  edge punctuation. DO NOT strip leading zeros — INV-0042 and INV-42 may be
--  different documents."
--
-- `immutable` is mandatory: this backs a stored generated column.
-- `set search_path = ''` makes it injection-safe (pg_catalog is always
-- implicitly searched, so the bare builtins below still resolve).
-- ---------------------------------------------------------------------------
create or replace function app.normalize_invoice_number(raw text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select upper(
    regexp_replace(                                  -- 4. strip trailing punctuation
      regexp_replace(                                -- 3. strip leading punctuation
        regexp_replace(btrim(raw), '\s+', ' ', 'g'), -- 2. collapse inner whitespace
        '^[^[:alnum:]]+', ''
      ),
      '[^[:alnum:]]+$', ''
    )
  );
$$;

comment on function app.normalize_invoice_number(text) is
  'Canonical invoice-number form. Deliberately preserves leading zeros: '
  'INV-0042 and INV-42 are different documents.';

-- ---------------------------------------------------------------------------
-- Domain rule: account name normalization
--
-- "Account names normalize by stripping Pvt Ltd, Private Limited, LLP, Inc,
--  &/and, punctuation, then case-folding."
--
-- Punctuation is stripped *first* so the legal-suffix patterns below can be
-- plain word-boundary matches (`\m…\M`) and never have to reason about a
-- trailing full stop. Word boundaries keep "Lincoln" from losing its "inc".
-- ---------------------------------------------------------------------------
create or replace function app.normalize_account_name(raw text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with cleaned as (
    select btrim(
      regexp_replace(
        regexp_replace(lower(btrim(raw)), '[^[:alnum:]]+', ' ', 'g'),
        '\s+', ' ', 'g'
      )
    ) as v
  ),
  no_pvt as (   -- two-word forms first: "pvt ltd", "private limited"
    select regexp_replace(v, '\m(pvt|private)\s+(ltd|limited)\M', ' ', 'g') as v,
           v as original
    from cleaned
  ),
  no_suffix as (
    select regexp_replace(
             v,
             '\m(ltd|limited|llp|llc|inc|incorporated|corp|corporation|co)\M',
             ' ', 'g'
           ) as v,
           original
    from no_pvt
  ),
  no_conj as (
    select regexp_replace(v, '\mand\M', ' ', 'g') as v, original from no_suffix
  )
  -- A company genuinely named "Co" would normalize to the empty string; fall
  -- back to the punctuation-cleaned form rather than collapsing every such
  -- account onto one key.
  select coalesce(
           nullif(btrim(regexp_replace(v, '\s+', ' ', 'g')), ''),
           original
         )
  from no_conj;
$$;

comment on function app.normalize_account_name(text) is
  'Canonical account-name form for duplicate detection across imports.';

grant execute on function app.normalize_invoice_number(text) to anon, authenticated;
grant execute on function app.normalize_account_name(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create or replace function app.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log
--
-- project.mdc: "Every mutation writes an auditLog row." Enforced structurally
-- by a trigger rather than by remembering to call something in each service
-- function.
--
-- Partitioned monthly from the outset: a single 5,000-row CSV import writes
-- 5,000 rows with full before/after JSONB, and retrofitting partitioning onto
-- a large table is far more painful than declaring it now.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  org_id      uuid,
  actor_id    uuid,
  table_name  text not null,
  record_id   text,
  op          text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  before      jsonb,
  after       jsonb,
  -- a partitioned table's primary key must include the partition key
  primary key (id, occurred_at)
) partition by range (occurred_at);

create index audit_log_org_time_idx on public.audit_log (org_id, occurred_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

-- 14 months of partitions up front, plus a catch-all so an insert can never
-- fail for want of a partition. Keep the default empty: rows sitting in it
-- block the creation of an overlapping partition later.
do $$
declare
  m date := date_trunc('month', current_date)::date;
  i int;
begin
  for i in -1 .. 12 loop
    execute format(
      'create table if not exists public.audit_log_%s partition of public.audit_log for values from (%L) to (%L)',
      to_char(m + (i || ' months')::interval, 'YYYYMM'),
      (m + (i || ' months')::interval)::date,
      (m + ((i + 1) || ' months')::interval)::date
    );
  end loop;
end $$;

create table if not exists public.audit_log_default partition of public.audit_log default;

create or replace function app.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_org   uuid;
  v_row   jsonb;
begin
  -- auth.uid() is NULL for service-role and background writes; those callers
  -- should `select set_config('app.actor_id', '<uuid>', true)` at the top of
  -- their transaction so the trail keeps its attribution.
  v_actor := coalesce(
    auth.uid(),
    nullif(current_setting('app.actor_id', true), '')::uuid
  );

  v_row := case tg_op when 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  -- `orgs` is its own tenant root and has no org_id column.
  v_org := nullif(
    coalesce(
      v_row ->> 'org_id',
      case when tg_table_name = 'orgs' then v_row ->> 'id' end
    ),
    ''
  )::uuid;

  insert into public.audit_log (org_id, actor_id, table_name, record_id, op, before, after)
  values (
    v_org,
    v_actor,
    tg_table_schema || '.' || tg_table_name,
    v_row ->> 'id',
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

-- Rows arrive only through the trigger above, which runs as the definer and so
-- is unaffected by RLS. No insert/update/delete policy is defined anywhere; the
-- select policy is added in the tenancy migration once roles exist.
alter table public.audit_log enable row level security;
revoke insert, update, delete on public.audit_log from anon, authenticated;
