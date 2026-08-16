-- Waitlist: backs the early-access form on the marketing landing page.
--
-- Deliberately outside the tenant model — a waitlist signup happens before any
-- org exists, so there is no org_id to scope it by and no audit trigger on it
-- (created_at is the whole story for a row that is never updated).

create table public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  email            text not null check (btrim(email) <> '' and position('@' in email) > 1),
  email_normalized text generated always as (lower(btrim(email))) stored,
  source           text,
  created_at       timestamptz not null default now()
);

-- Lets the insert use `on conflict do nothing`, so a repeat signup is a no-op
-- rather than an error the UI would have to explain.
create unique index waitlist_email_normalized_uniq on public.waitlist (email_normalized);

alter table public.waitlist enable row level security;

-- Write-only to the world: anyone may join, nobody may read the list back.
-- A public signup form should not double as an email-harvesting endpoint, so
-- there is deliberately NO select policy — only the service role can read it.
create policy waitlist_insert_public on public.waitlist
  for insert to anon, authenticated
  with check (true);

revoke update, delete on public.waitlist from anon, authenticated;
