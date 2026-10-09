-- GrowthOS -> GrowthMission (client-confirmed, 2026-10-09).
--
-- The product is renamed, so the schema is renamed with it. Every object
-- here carries the old brand in its name; none of them carry data that
-- moves. ALTER ... RENAME is in-place and instant, so this is a metadata
-- change, not a data migration.
--
-- The migrations before this one are deliberately left alone. They are an
-- append-only record of what was applied: rewriting them would claim these
-- tables were created as growth_mission_*, when they were created as
-- gos_dashboard_* and renamed here. A fresh database replays them in order
-- and arrives at the same place.
--
-- DEPLOY NOTE. Code and schema must go out together. Between this
-- migration running and the new build being live, the old build would be
-- querying table names that no longer exist.


-- Enum types
----------------------------------------------------------------------
alter type gos_dashboard_kpi_box rename to growth_mission_kpi_box;
alter type gos_dashboard_priority rename to growth_mission_priority;
alter type gos_dashboard_status rename to growth_mission_status;
alter type gos_dashboard_step rename to growth_mission_step;
alter type gos_dashboard_task_state rename to growth_mission_task_state;

-- Tables
----------------------------------------------------------------------
alter table gos_dashboard_kpi_mapping rename to growth_mission_kpi_mapping;
alter table gos_dashboard_kpis rename to growth_mission_kpis;
alter table gos_dashboard_quarter_hours rename to growth_mission_quarter_hours;
alter table gos_dashboard_reports rename to growth_mission_reports;
alter table gos_dashboard_status_report_stats rename to growth_mission_status_report_stats;
alter table gos_dashboard_step_hours rename to growth_mission_step_hours;
alter table gos_dashboard_step_status rename to growth_mission_step_status;
alter table gos_dashboard_suggestions rename to growth_mission_suggestions;
alter table gos_dashboard_tasks rename to growth_mission_tasks;
alter table gos_dashboard_tracker_items rename to growth_mission_tracker_items;

-- Functions
----------------------------------------------------------------------
alter function gos_dashboard_source_counts(p_account_id uuid) rename to growth_mission_source_counts;

-- Indexes
----------------------------------------------------------------------
alter index gos_dashboard_kpi_mapping_account_id_contact_status_id_key rename to growth_mission_kpi_mapping_account_id_contact_status_id_key;
alter index gos_dashboard_kpi_mapping_account_id_idx rename to growth_mission_kpi_mapping_account_id_idx;
alter index gos_dashboard_kpi_mapping_account_id_opportunity_stage_id_key rename to growth_mission_kpi_mapping_account_id_opportunity_stage_id_key;
alter index gos_dashboard_kpi_mapping_pkey rename to growth_mission_kpi_mapping_pkey;
alter index gos_dashboard_kpis_account_step_idx rename to growth_mission_kpis_account_step_idx;
alter index gos_dashboard_kpis_pkey rename to growth_mission_kpis_pkey;
alter index gos_dashboard_quarter_hours_account_id_step_slug_quarter_st_key rename to growth_mission_quarter_hours_account_id_step_slug_quarter_st_key;
alter index gos_dashboard_quarter_hours_account_quarter_idx rename to growth_mission_quarter_hours_account_quarter_idx;
alter index gos_dashboard_quarter_hours_pkey rename to growth_mission_quarter_hours_pkey;
alter index gos_dashboard_reports_account_step_idx rename to growth_mission_reports_account_step_idx;
alter index gos_dashboard_reports_file_path_key rename to growth_mission_reports_file_path_key;
alter index gos_dashboard_reports_pkey rename to growth_mission_reports_pkey;
alter index gos_dashboard_status_report_stats_account_step_idx rename to growth_mission_status_report_stats_account_step_idx;
alter index gos_dashboard_status_report_stats_pkey rename to growth_mission_status_report_stats_pkey;
alter index gos_dashboard_step_hours_account_id_idx rename to growth_mission_step_hours_account_id_idx;
alter index gos_dashboard_step_hours_account_id_step_slug_key rename to growth_mission_step_hours_account_id_step_slug_key;
alter index gos_dashboard_step_hours_pkey rename to growth_mission_step_hours_pkey;
alter index gos_dashboard_step_status_account_id_idx rename to growth_mission_step_status_account_id_idx;
alter index gos_dashboard_step_status_account_id_step_slug_key rename to growth_mission_step_status_account_id_step_slug_key;
alter index gos_dashboard_step_status_pkey rename to growth_mission_step_status_pkey;
alter index gos_dashboard_suggestions_account_step_idx rename to growth_mission_suggestions_account_step_idx;
alter index gos_dashboard_suggestions_pkey rename to growth_mission_suggestions_pkey;
alter index gos_dashboard_tasks_account_step_idx rename to growth_mission_tasks_account_step_idx;
alter index gos_dashboard_tasks_assignee_idx rename to growth_mission_tasks_assignee_idx;
alter index gos_dashboard_tasks_pkey rename to growth_mission_tasks_pkey;
alter index gos_dashboard_tracker_items_account_step_idx rename to growth_mission_tracker_items_account_step_idx;
alter index gos_dashboard_tracker_items_pkey rename to growth_mission_tracker_items_pkey;

-- Row-level security policies
----------------------------------------------------------------------
alter policy gos_dashboard_kpi_mapping_insert on growth_mission_kpi_mapping rename to growth_mission_kpi_mapping_insert;
alter policy gos_dashboard_kpi_mapping_select on growth_mission_kpi_mapping rename to growth_mission_kpi_mapping_select;
alter policy gos_dashboard_kpi_mapping_update on growth_mission_kpi_mapping rename to growth_mission_kpi_mapping_update;
alter policy gos_dashboard_kpis_select on growth_mission_kpis rename to growth_mission_kpis_select;
alter policy gos_dashboard_kpis_update on growth_mission_kpis rename to growth_mission_kpis_update;
alter policy gos_dashboard_kpis_write on growth_mission_kpis rename to growth_mission_kpis_write;
alter policy gos_dashboard_quarter_hours_insert on growth_mission_quarter_hours rename to growth_mission_quarter_hours_insert;
alter policy gos_dashboard_quarter_hours_select on growth_mission_quarter_hours rename to growth_mission_quarter_hours_select;
alter policy gos_dashboard_quarter_hours_update on growth_mission_quarter_hours rename to growth_mission_quarter_hours_update;
alter policy gos_dashboard_reports_insert on growth_mission_reports rename to growth_mission_reports_insert;
alter policy gos_dashboard_reports_select on growth_mission_reports rename to growth_mission_reports_select;
alter policy gos_dashboard_reports_update on growth_mission_reports rename to growth_mission_reports_update;
alter policy gos_dashboard_status_report_stats_select on growth_mission_status_report_stats rename to growth_mission_status_report_stats_select;
alter policy gos_dashboard_status_report_stats_update on growth_mission_status_report_stats rename to growth_mission_status_report_stats_update;
alter policy gos_dashboard_status_report_stats_write on growth_mission_status_report_stats rename to growth_mission_status_report_stats_write;
alter policy gos_dashboard_step_hours_insert on growth_mission_step_hours rename to growth_mission_step_hours_insert;
alter policy gos_dashboard_step_hours_select on growth_mission_step_hours rename to growth_mission_step_hours_select;
alter policy gos_dashboard_step_hours_update on growth_mission_step_hours rename to growth_mission_step_hours_update;
alter policy gos_dashboard_step_status_select on growth_mission_step_status rename to growth_mission_step_status_select;
alter policy gos_dashboard_step_status_update on growth_mission_step_status rename to growth_mission_step_status_update;
alter policy gos_dashboard_step_status_write on growth_mission_step_status rename to growth_mission_step_status_write;
alter policy gos_dashboard_suggestions_select on growth_mission_suggestions rename to growth_mission_suggestions_select;
alter policy gos_dashboard_suggestions_update on growth_mission_suggestions rename to growth_mission_suggestions_update;
alter policy gos_dashboard_suggestions_write on growth_mission_suggestions rename to growth_mission_suggestions_write;
alter policy gos_dashboard_tasks_insert on growth_mission_tasks rename to growth_mission_tasks_insert;
alter policy gos_dashboard_tasks_select on growth_mission_tasks rename to growth_mission_tasks_select;
alter policy gos_dashboard_tasks_update on growth_mission_tasks rename to growth_mission_tasks_update;
alter policy gos_dashboard_tracker_items_select on growth_mission_tracker_items rename to growth_mission_tracker_items_select;
alter policy gos_dashboard_tracker_items_update on growth_mission_tracker_items rename to growth_mission_tracker_items_update;
alter policy gos_dashboard_tracker_items_write on growth_mission_tracker_items rename to growth_mission_tracker_items_write;

-- Triggers
----------------------------------------------------------------------
alter trigger trg_gos_dashboard_kpi_mapping_updated_at on growth_mission_kpi_mapping rename to trg_growth_mission_kpi_mapping_updated_at;
alter trigger trg_gos_dashboard_kpis_updated_at on growth_mission_kpis rename to trg_growth_mission_kpis_updated_at;
alter trigger trg_gos_dashboard_quarter_hours_updated_at on growth_mission_quarter_hours rename to trg_growth_mission_quarter_hours_updated_at;
alter trigger trg_gos_dashboard_status_report_stats_updated_at on growth_mission_status_report_stats rename to trg_growth_mission_status_report_stats_updated_at;
alter trigger trg_gos_dashboard_step_hours_updated_at on growth_mission_step_hours rename to trg_growth_mission_step_hours_updated_at;
alter trigger trg_gos_dashboard_step_status_updated_at on growth_mission_step_status rename to trg_growth_mission_step_status_updated_at;
alter trigger trg_gos_dashboard_suggestions_updated_at on growth_mission_suggestions rename to trg_growth_mission_suggestions_updated_at;
alter trigger trg_gos_dashboard_tasks_achieved on growth_mission_tasks rename to trg_growth_mission_tasks_achieved;
alter trigger trg_gos_dashboard_tasks_completed_at on growth_mission_tasks rename to trg_growth_mission_tasks_completed_at;
alter trigger trg_gos_dashboard_tasks_updated_at on growth_mission_tasks rename to trg_growth_mission_tasks_updated_at;
alter trigger trg_gos_dashboard_tracker_items_updated_at on growth_mission_tracker_items rename to trg_growth_mission_tracker_items_updated_at;

-- Function bodies
----------------------------------------------------------------------
-- Renaming a table does NOT rewrite the functions that query it: a
-- PL/pgSQL or SQL body is stored as text and resolved when it runs. Both
-- of these would have kept pointing at gos_dashboard_* and failed at the
-- next call, silently in the trigger's case. They are recreated verbatim
-- apart from the names.

create or replace function public.cro_account_portfolio()
returns table(
  account_id uuid,
  questionnaire_complete boolean,
  vision_board_complete boolean,
  committed_hours numeric,
  achieved_hours numeric,
  last_activity_at timestamp with time zone
)
language sql
stable
set search_path to 'public'
as $function$
  select
    a.id,
    exists (select 1 from growth_questionnaire_responses r where r.account_id = a.id and r.completed_at is not null),
    exists (select 1 from vision_board_responses v where v.account_id = a.id and v.completed_at is not null),
    coalesce((select sum(h.committed_hours) from growth_mission_quarter_hours h
              where h.account_id = a.id and h.quarter_start = date_trunc('quarter', now())::date), 0),
    coalesce((select sum(h.achieved_hours) from growth_mission_quarter_hours h
              where h.account_id = a.id and h.quarter_start = date_trunc('quarter', now())::date), 0),
    (select max(x.occurred_at) from activities x where x.account_id = a.id and x.archived_at is null)
  from accounts a
  where a.archived_at is null
$function$;

-- Also declares a variable of the renamed enum type, so this one would
-- have broken on the type rename alone even without the table rename.
create or replace function public.sync_task_achieved_hours()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old numeric := 0;
  v_new numeric := 0;
  v_delta numeric;
  v_quarter date;
  v_account uuid;
  v_slug growth_mission_step;
begin
  if tg_op <> 'INSERT' then
    v_old := case when old.state = 'complete' and old.archived_at is null then old.hours else 0 end;
  end if;
  if tg_op <> 'DELETE' then
    v_new := case when new.state = 'complete' and new.archived_at is null then new.hours else 0 end;
  end if;

  v_delta := v_new - v_old;
  if v_delta = 0 then
    return coalesce(new, old);
  end if;

  v_account := coalesce(new.account_id, old.account_id);
  v_slug := coalesce(new.step_slug, old.step_slug);
  v_quarter := date_trunc('quarter', coalesce(new.completed_at, old.completed_at, now()))::date;

  insert into growth_mission_quarter_hours (account_id, step_slug, quarter_start, achieved_hours)
  values (v_account, v_slug, v_quarter, greatest(v_delta, 0))
  on conflict (account_id, step_slug, quarter_start)
  do update set achieved_hours = greatest(growth_mission_quarter_hours.achieved_hours + v_delta, 0);

  return coalesce(new, old);
end;
$function$;
