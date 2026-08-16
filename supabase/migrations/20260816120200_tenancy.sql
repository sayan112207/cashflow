-- Tenancy: orgs, membership, and the RLS primitives every other table depends on.
--
-- project.mdc: "Never assume single user, single entity, or single currency."

create type public.org_role as enum ('owner', 'admin', 'member');

create table public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  org_id     uuid not null references public.orgs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers.
--
-- `security definer` here is load-bearing, not a convenience. A policy ON
-- org_members that itself SELECTs org_members recurses and Postgres raises
-- 42P17 (infinite recursion detected in policy). These functions are owned by
-- postgres, which owns the tables and is therefore exempt from their RLS, so
-- the policy can ask "is this user a member?" without re-entering the policy.
-- ---------------------------------------------------------------------------
create or replace function app.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function app.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

grant execute on function app.is_org_member(uuid) to authenticated;
grant execute on function app.has_org_role(uuid, public.org_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Org creation.
--
-- Chicken-and-egg: an authenticated user cannot insert into `orgs` and then
-- into `org_members`, because the org_members insert policy requires membership
-- in an org they are not yet a member of. And PostgREST gives each supabase-js
-- call its own transaction, so a two-call client-side version can half-fail.
-- One definer RPC does both atomically.
-- ---------------------------------------------------------------------------
create or replace function public.create_org(p_name text)
returns public.orgs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org  public.orgs;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'organisation name is required' using errcode = '22023';
  end if;

  insert into public.orgs (name, created_by)
  values (btrim(p_name), v_user)
  returning * into v_org;

  insert into public.org_members (org_id, user_id, role)
  values (v_org.id, v_user, 'owner');

  return v_org;
end;
$$;

revoke execute on function public.create_org(text) from public, anon;
grant execute on function public.create_org(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

create policy orgs_select_member on public.orgs
  for select to authenticated
  using (app.is_org_member(id));

create policy orgs_update_admin on public.orgs
  for update to authenticated
  using (app.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (app.has_org_role(id, array['owner', 'admin']::public.org_role[]));

-- No insert policy: orgs are created only through public.create_org().
-- No delete policy: deleting an org would cascade away collections history.

create policy org_members_select on public.org_members
  for select to authenticated
  using (user_id = auth.uid() or app.is_org_member(org_id));

create policy org_members_write_admin on public.org_members
  for all to authenticated
  using (app.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (app.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- Audit log is readable by org admins only; still no write policies anywhere.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (
    org_id is not null
    and app.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger orgs_touch_updated_at
  before update on public.orgs
  for each row execute function app.tg_touch_updated_at();

create trigger orgs_audit
  after insert or update or delete on public.orgs
  for each row execute function app.tg_audit();

create trigger org_members_audit
  after insert or update or delete on public.org_members
  for each row execute function app.tg_audit();
