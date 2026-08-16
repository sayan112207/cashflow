-- User profiles, and the display-name derivation that backs both sign-in paths.
--
-- Google returns a real full name in the ID token; email/password signups have
-- no name at all, so one is derived from the address. Both land in the same
-- column so the UI never has to care which provider a user came from.

-- ---------------------------------------------------------------------------
-- "sayan.banerjee@workindia.in" -> "Sayan Banerjee"
--
-- Plus-addressing is dropped before parsing (sayan+test@ is still Sayan), and
-- digits are stripped so sayan112207@ does not become "Sayan112207". If that
-- leaves nothing — an all-numeric local part — fall back to the raw local part
-- rather than returning an empty name.
-- ---------------------------------------------------------------------------
create or replace function app.display_name_from_email(p_email text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with local_part as (
    select lower(split_part(btrim(p_email), '@', 1)) as v
  ),
  without_plus_suffix as (
    select split_part(v, '+', 1) as v from local_part
  ),
  separators_to_spaces as (
    select regexp_replace(v, '[._\-]+', ' ', 'g') as v from without_plus_suffix
  ),
  without_digits as (
    select regexp_replace(v, '[0-9]+', '', 'g') as v from separators_to_spaces
  ),
  collapsed as (
    select btrim(regexp_replace(v, '\s+', ' ', 'g')) as v from without_digits
  )
  select coalesce(
    nullif(initcap(v), ''),
    initcap(split_part(btrim(p_email), '@', 1))
  )
  from collapsed;
$$;

comment on function app.display_name_from_email(text) is
  'Best-effort human name from an email local part, for accounts with no name '
  'from an identity provider.';

grant execute on function app.display_name_from_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function app.tg_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Populate a profile the moment an auth user is created, whichever provider
-- they used.
--
-- Google puts the name in raw_user_meta_data as `full_name` (and `name`), and
-- the avatar as `avatar_url` (and `picture`); password signups have neither.
--
-- Deliberately forgiving: this trigger runs inside the signup transaction, so
-- an exception here would fail the signup itself. Every lookup is coalesced and
-- the insert is `on conflict do nothing`.
-- ---------------------------------------------------------------------------
create or replace function app.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_avatar text;
begin
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  v_avatar := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  )), '');

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      v_name,                                              -- from the provider
      app.display_name_from_email(new.email),              -- derived
      'There'                                              -- last resort
    ),
    v_avatar
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.tg_handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Definer, for the same reason as app.is_org_member: a policy that joins
-- org_members must not re-enter org_members' own policies.
create or replace function app.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_members mine
    join public.org_members theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user
  );
$$;

grant execute on function app.shares_org_with(uuid) to authenticated;

create policy profiles_select_self_or_teammate on public.profiles
  for select to authenticated
  using (id = auth.uid() or app.shares_org_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy: rows come only from the signup trigger.
-- No delete policy: profiles die with their auth.users row.

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function app.tg_audit();
