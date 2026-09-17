-- GOS Dashboard hours + KPI band (client-confirmed addition, 2026-09-17).
--
-- Hours: per account per Playbook step, "hours needed to complete" spans
-- the whole workstream (one row per step), while "committed" and
-- "achieved" are per calendar quarter (one row per step per quarter, so
-- they start fresh each quarter without deleting anything). Outsourced is
-- a Yes/No placeholder for now. Client-confirmed write access: CRO
-- Admin/Advisor for any account, plus the account's own MSP Owner/Admin.
--
-- KPI band: the Playbook doc's "GrowthOS KPI dashboard" (Prospects: MQCs,
-- MQLs; Opportunities in Pipeline: Interested, Engaged, Ghosted, Quoted,
-- Won, Lost), counted live from contacts/opportunities. Stage and status
-- names differ per account, so gos_dashboard_kpi_mapping records which
-- status/stage feeds which box. No rows for an account means the app's
-- name-matching defaults apply. Each status/stage has at most one row and
-- is updated in place (box = null means "counts toward no box"), so there
-- is nothing to soft-delete. Write access: CRO Admin/Advisor only.

create table gos_dashboard_step_hours (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  needed_hours numeric(7,1) not null default 0 check (needed_hours >= 0),
  outsourced boolean not null default false,
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, step_slug)
);
create index gos_dashboard_step_hours_account_id_idx on gos_dashboard_step_hours(account_id);

create table gos_dashboard_quarter_hours (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  quarter_start date not null check (quarter_start = date_trunc('quarter', quarter_start)::date),
  committed_hours numeric(7,1) not null default 0 check (committed_hours >= 0),
  achieved_hours numeric(7,1) not null default 0 check (achieved_hours >= 0),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, step_slug, quarter_start)
);
create index gos_dashboard_quarter_hours_account_quarter_idx on gos_dashboard_quarter_hours(account_id, quarter_start);

create type gos_dashboard_kpi_box as enum ('mqc', 'mql', 'interested', 'engaged', 'ghosted', 'quoted', 'won', 'lost');

create table gos_dashboard_kpi_mapping (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  box gos_dashboard_kpi_box,
  contact_status_id uuid references contact_statuses(id),
  opportunity_stage_id uuid references opportunity_stages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(contact_status_id, opportunity_stage_id) = 1),
  unique (account_id, contact_status_id),
  unique (account_id, opportunity_stage_id)
);
create index gos_dashboard_kpi_mapping_account_id_idx on gos_dashboard_kpi_mapping(account_id);

alter table gos_dashboard_step_hours enable row level security;
alter table gos_dashboard_quarter_hours enable row level security;
alter table gos_dashboard_kpi_mapping enable row level security;

create policy gos_dashboard_step_hours_select on gos_dashboard_step_hours for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_step_hours_insert on gos_dashboard_step_hours for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );
create policy gos_dashboard_step_hours_update on gos_dashboard_step_hours for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

create policy gos_dashboard_quarter_hours_select on gos_dashboard_quarter_hours for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_quarter_hours_insert on gos_dashboard_quarter_hours for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );
create policy gos_dashboard_quarter_hours_update on gos_dashboard_quarter_hours for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

create policy gos_dashboard_kpi_mapping_select on gos_dashboard_kpi_mapping for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_kpi_mapping_insert on gos_dashboard_kpi_mapping for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_kpi_mapping_update on gos_dashboard_kpi_mapping for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create trigger trg_gos_dashboard_step_hours_updated_at before update on gos_dashboard_step_hours
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_quarter_hours_updated_at before update on gos_dashboard_quarter_hours
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_kpi_mapping_updated_at before update on gos_dashboard_kpi_mapping
  for each row execute function set_updated_at();

-- One round trip for every status/stage count the KPI band and its mapping
-- editor need. security invoker: runs as the caller, so contacts and
-- opportunities RLS still decide what gets counted.
create function gos_dashboard_source_counts(p_account_id uuid)
returns table (source_kind text, source_id uuid, record_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 'contact_status', c.status_id, count(*)
  from contacts c
  where c.account_id = p_account_id and c.archived_at is null and c.status_id is not null
  group by c.status_id
  union all
  select 'opportunity_stage', o.stage_id, count(*)
  from opportunities o
  where o.account_id = p_account_id
  group by o.stage_id
$$;
