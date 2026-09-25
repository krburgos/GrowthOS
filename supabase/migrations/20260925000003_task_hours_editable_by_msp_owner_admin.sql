-- Client-confirmed amendment (2026-09-25): MSP Owner and Admin can change a
-- task's hours. This narrows prevent_task_definition_change(), which since
-- earlier the same day confined those roles to state and assignee_id.
--
-- The line moves from "only CRO Leader touches anything but state and
-- assignee" to "CRO Leader says what the work is; the account says how it is
-- tracked." Hours are an estimate of how long a job takes, and the account
-- running the work is usually the party that finds out the estimate was
-- wrong. They already own the achieved-hours figure that a completed task
-- feeds, so letting them correct the number that feeds it is consistent.
--
-- Title, detail, priority, step and archived_at stay with CRO Leader: those
-- are what the work IS, which is theirs to prescribe.
--
-- sync_task_achieved_hours() needs no change - it already applies the
-- difference between what a row used to contribute and what it contributes
-- now, so an hours edit on a completed task adjusts the quarter correctly.
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
     or new.step_slug is distinct from old.step_slug
     or new.archived_at is distinct from old.archived_at then
    raise exception 'Only CRO Leader can change what a task is. You can set its hours, its state and who it is assigned to.';
  end if;

  return new;
end;
$function$;
