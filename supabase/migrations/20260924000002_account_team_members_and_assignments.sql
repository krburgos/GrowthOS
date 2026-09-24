-- Client-confirmed (2026-09-24): the Company Profile's Sales & Marketing
-- list stops being a text[] of names and becomes a real roster carrying a
-- title, a weekly hours commitment, and which of the 14 workstreams each
-- person is responsible for.
--
-- Two rosters, one table: "in_house" is the account's own staff, and
-- "outsourced" is a third party delivering a workstream - which may be CRO
-- Leader or anyone else. The fields are identical, so a kind column beats
-- two tables. Name is one free field so "Rosa Pineda - Northlight Events"
-- fits as easily as a person alone.
--
-- Deliberately NOT wired to the Command Center's hours for now
-- (client-confirmed): these are weekly intent, gos_dashboard_quarter_hours
-- is what was committed and done for a quarter. No rule is enforced between
-- a person's commitment and the sum of their assignments either.

create type account_team_kind as enum ('in_house', 'outsourced');

create table account_team_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  kind account_team_kind not null,
  name text not null check (length(trim(name)) > 0),
  title text,
  weekly_hours numeric(5,1) not null default 0 check (weekly_hours >= 0),
  -- Some staff are GrowthOS users and some are not (client-confirmed), so
  -- this is an optional link rather than the identity of the row.
  user_id uuid references users(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- The join to the 14 workstreams. step_slug matches PLAYBOOK_STEPS in
-- lib/gos-dashboard/playbook.ts, the same way gos_dashboard_step_hours does
-- - the step list is app code, not schema.
create table account_team_assignments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  member_id uuid not null references account_team_members(id) on delete cascade,
  step_slug text not null,
  weekly_hours numeric(5,1) not null default 0 check (weekly_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, step_slug)
);

create index account_team_members_account_id_idx on account_team_members(account_id);
create index account_team_assignments_account_id_idx on account_team_assignments(account_id);
create index account_team_assignments_member_id_idx on account_team_assignments(member_id);
create index account_team_assignments_step_slug_idx on account_team_assignments(account_id, step_slug);

alter table account_team_members enable row level security;
alter table account_team_assignments enable row level security;

-- Read matches accounts_select; write matches accounts_update exactly, since
-- this is part of the Company Profile (client-confirmed). Note accounts_update
-- has no partner clause, so neither does this: a partner reads but does not
-- edit an MSP's own roster.
create policy account_team_members_select on account_team_members for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy account_team_members_insert on account_team_members for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy account_team_members_update on account_team_members for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

-- Members are soft-deleted via archived_at, so there is no delete policy.

create policy account_team_assignments_select on account_team_assignments for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy account_team_assignments_insert on account_team_assignments for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy account_team_assignments_update on account_team_assignments for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

-- Assignments are a join row, not a record with history - removing one is a
-- real delete, the same shape list_members already uses.
create policy account_team_assignments_delete on account_team_assignments for delete
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create trigger trg_account_team_members_updated_at before update on account_team_members
  for each row execute function set_updated_at();
create trigger trg_account_team_assignments_updated_at before update on account_team_assignments
  for each row execute function set_updated_at();

-- Carry the existing names across rather than dropping them; title and hours
-- start blank because there was nowhere to have recorded them.
insert into account_team_members (account_id, kind, name, sort_order)
select a.id, 'in_house', trim(n.name), n.ord - 1
from accounts a
cross join lateral unnest(a.sales_marketing_names) with ordinality as n(name, ord)
where a.sales_marketing_names is not null and trim(n.name) <> '';
