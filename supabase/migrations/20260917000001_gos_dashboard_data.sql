-- GOS Dashboard manual data entry (client-confirmed addition, 2026-09-16).
-- Replaces the mockup's hardcoded per-account fields (lib/gos-dashboard/
-- playbook.ts) with real per-account data the CRO Leader team enters.
-- Step identity (title/icon/phase/duties/whether a step gets the SEO/GEO
-- 3-tab shape) stays in app code, same reasoning as growth_questionnaire_
-- responses and vision_board_responses — only the CRO-Leader-entered
-- values below live in the DB.
--
-- Write access is CRO Admin/Advisor only (open item #1 in the plan this
-- migration ships with — confirm before relying on this). MSP roles get
-- read-only, the inverse of the Questionnaire/Vision Board pattern,
-- because this is CRO Leader's own service-delivery tracking, not
-- something the MSP fills in themselves.

create type gos_dashboard_step as enum (
  'seo', 'geo', 'blogging-content', 'social-media', 'website-oversight',
  'icp-development', 'list-building', 'email-campaigning', 'crm-administration',
  'pipeline-metrics', 'reviews-testimonials', 'events', 'sdr-outreach', 'sales-enablement'
);

create type gos_dashboard_status as enum ('on_track', 'ahead', 'needs_attention');

create type gos_dashboard_priority as enum ('high', 'medium', 'low');

-- One row per account per step: the card's status pill + headline stat,
-- plus (SEO/GEO only, nullable for the other 12) the status report
-- narrative summary.
create table gos_dashboard_step_status (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  status gos_dashboard_status not null default 'on_track',
  headline_label text,
  headline_value text,
  status_report_summary text,
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, step_slug)
);
create index gos_dashboard_step_status_account_id_idx on gos_dashboard_step_status(account_id);

create table gos_dashboard_kpis (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  value text not null,
  target text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_kpis_account_step_idx on gos_dashboard_kpis(account_id, step_slug);

-- SEO/GEO's Status Report tab stat row(s) — a different list than the
-- KPIs grid at the bottom of the same step (the doc shows both).
create table gos_dashboard_status_report_stats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  value text not null,
  target text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_status_report_stats_account_step_idx on gos_dashboard_status_report_stats(account_id, step_slug);

create table gos_dashboard_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  title text not null,
  priority gos_dashboard_priority not null default 'medium',
  detail text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_suggestions_account_step_idx on gos_dashboard_suggestions(account_id, step_slug);

create table gos_dashboard_tracker_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_tracker_items_account_step_idx on gos_dashboard_tracker_items(account_id, step_slug);

alter table gos_dashboard_step_status enable row level security;
alter table gos_dashboard_kpis enable row level security;
alter table gos_dashboard_status_report_stats enable row level security;
alter table gos_dashboard_suggestions enable row level security;
alter table gos_dashboard_tracker_items enable row level security;

-- Read: same three-way pattern as every other tenant table (own account,
-- any CRO Leader role, a granted partner). Write: CRO Admin/Advisor only
-- (open item #1) — no msp_owner/msp_admin bypass, deliberately.
create policy gos_dashboard_step_status_select on gos_dashboard_step_status for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_step_status_write on gos_dashboard_step_status for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_step_status_update on gos_dashboard_step_status for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_kpis_select on gos_dashboard_kpis for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_kpis_write on gos_dashboard_kpis for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_kpis_update on gos_dashboard_kpis for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_status_report_stats_select on gos_dashboard_status_report_stats for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_status_report_stats_write on gos_dashboard_status_report_stats for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_status_report_stats_update on gos_dashboard_status_report_stats for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_suggestions_select on gos_dashboard_suggestions for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_suggestions_write on gos_dashboard_suggestions for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_suggestions_update on gos_dashboard_suggestions for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_tracker_items_select on gos_dashboard_tracker_items for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_tracker_items_write on gos_dashboard_tracker_items for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_tracker_items_update on gos_dashboard_tracker_items for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create trigger trg_gos_dashboard_step_status_updated_at before update on gos_dashboard_step_status
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_kpis_updated_at before update on gos_dashboard_kpis
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_status_report_stats_updated_at before update on gos_dashboard_status_report_stats
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_suggestions_updated_at before update on gos_dashboard_suggestions
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_tracker_items_updated_at before update on gos_dashboard_tracker_items
  for each row execute function set_updated_at();
