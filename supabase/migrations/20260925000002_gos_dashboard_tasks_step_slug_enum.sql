-- step_slug is the gos_dashboard_step enum everywhere else in this schema
-- (gos_dashboard_step_hours, gos_dashboard_quarter_hours). Tasks were
-- created with text, which made the achieved-hours trigger fail on insert
-- into quarter_hours. Match the rest of the schema rather than casting
-- around it.
alter table gos_dashboard_tasks
  alter column step_slug type gos_dashboard_step using step_slug::gos_dashboard_step;

create or replace function sync_task_achieved_hours()
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
  v_slug gos_dashboard_step;
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

  insert into gos_dashboard_quarter_hours (account_id, step_slug, quarter_start, achieved_hours)
  values (v_account, v_slug, v_quarter, greatest(v_delta, 0))
  on conflict (account_id, step_slug, quarter_start)
  do update set achieved_hours = greatest(gos_dashboard_quarter_hours.achieved_hours + v_delta, 0);

  return coalesce(new, old);
end;
$function$;
