-- Client-confirmed (2026-09-25): each workstream's Suggestions & Fixes list
-- becomes a task list - a to-do for a person, with an owner, hours, a state
-- and a due date. The suggestions list was already CRO-authored "here is
-- what to fix" with a priority and a detail line, which is a task without
-- those four things, so tasks replace it rather than sitting beside it.

create type gos_dashboard_task_state as enum ('active', 'in_progress', 'on_hold', 'complete');

create table gos_dashboard_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  step_slug text not null,
  title text not null check (length(trim(title)) > 0),
  detail text,
  priority gos_dashboard_priority not null default 'medium',
  state gos_dashboard_task_state not null default 'active',
  -- Assignable to anyone on either Company Profile roster (client-confirmed).
  -- Set null rather than cascading, so removing someone leaves the task
  -- unassigned rather than deleting the work.
  assignee_id uuid references account_team_members(id) on delete set null,
  hours numeric(6,1) not null default 0 check (hours >= 0),
  due_date date,
  sort_order integer not null default 0,
  -- Stamped when the task first reaches 'complete'; the achieved-hours
  -- trigger below reads it to know which quarter the work landed in.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index gos_dashboard_tasks_account_step_idx on gos_dashboard_tasks(account_id, step_slug);
create index gos_dashboard_tasks_assignee_idx on gos_dashboard_tasks(assignee_id);

alter table gos_dashboard_tasks enable row level security;

create policy gos_dashboard_tasks_select on gos_dashboard_tasks for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

-- Only CRO Leader prescribes the work (client-confirmed).
create policy gos_dashboard_tasks_insert on gos_dashboard_tasks for insert
  with check (auth_has_any_role('cro_admin','cro_advisor'));

-- But marking work done is not the same as prescribing it, and completing a
-- task moves achieved hours, which MSP Owner/Admin already control - so they
-- may update too. The trigger below confines them to state and assignee.
create policy gos_dashboard_tasks_update on gos_dashboard_tasks for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

-- Tasks are soft-deleted via archived_at, so there is no delete policy.

/**
 * Who may change what. RLS grants the row; this confines which columns a
 * non-CRO role may move, the same shape prevent_self_role_escalation uses
 * on users. Owner/Admin get state, assignee and the bookkeeping columns;
 * everything that defines the work itself stays with CRO Leader.
 */
create or replace function prevent_task_definition_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth_has_any_role('cro_admin','cro_advisor') then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.detail is distinct from old.detail
     or new.priority is distinct from old.priority
     or new.hours is distinct from old.hours
     or new.due_date is distinct from old.due_date
     or new.step_slug is distinct from old.step_slug
     or new.archived_at is distinct from old.archived_at then
    raise exception 'Only CRO Leader can change what a task is. You can set its state and who it is assigned to.';
  end if;

  return new;
end;
$function$;

create trigger trg_gos_dashboard_tasks_definition before update on gos_dashboard_tasks
  for each row execute function prevent_task_definition_change();

/**
 * Completing a task feeds the workstream's achieved hours for the quarter
 * (client-confirmed). Done in a trigger rather than the app so the two can
 * never drift: the arithmetic is the difference between what this row used
 * to contribute and what it contributes now, so re-opening a task subtracts,
 * editing hours on a complete task adjusts, and archiving removes.
 *
 * Tasks are not tied to a quarter but achieved hours are, so a task lands in
 * whichever quarter it was completed in - which makes the figure mean "what
 * got done this quarter".
 */
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
  v_slug text;
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
  -- The quarter the task was completed in, falling back to now for the row
  -- being re-opened or edited.
  v_quarter := date_trunc('quarter', coalesce(new.completed_at, old.completed_at, now()))::date;

  insert into gos_dashboard_quarter_hours (account_id, step_slug, quarter_start, achieved_hours)
  values (v_account, v_slug, v_quarter, greatest(v_delta, 0))
  on conflict (account_id, step_slug, quarter_start)
  do update set achieved_hours = greatest(gos_dashboard_quarter_hours.achieved_hours + v_delta, 0);

  return coalesce(new, old);
end;
$function$;

-- completed_at is stamped before the hours trigger reads it.
create or replace function stamp_task_completed_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.state = 'complete' and (tg_op = 'INSERT' or old.state is distinct from 'complete') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.state <> 'complete' then
    new.completed_at := null;
  end if;
  return new;
end;
$function$;

create trigger trg_gos_dashboard_tasks_completed_at before insert or update on gos_dashboard_tasks
  for each row execute function stamp_task_completed_at();

create trigger trg_gos_dashboard_tasks_achieved after insert or update or delete on gos_dashboard_tasks
  for each row execute function sync_task_achieved_hours();

create trigger trg_gos_dashboard_tasks_updated_at before update on gos_dashboard_tasks
  for each row execute function set_updated_at();

-- Carry the six existing suggestions across as tasks rather than losing
-- them. They arrive unassigned, with no hours and no due date, because
-- there was nowhere to have recorded those.
insert into gos_dashboard_tasks (account_id, step_slug, title, detail, priority, sort_order)
select s.account_id, s.step_slug, s.title, nullif(trim(coalesce(s.detail, '')), ''), s.priority,
       row_number() over (partition by s.account_id, s.step_slug order by s.created_at) - 1
from gos_dashboard_suggestions s
where s.archived_at is null;
