-- Client-confirmed (2026-09-25): MSP Owner and Admin can add and edit tasks,
-- not only track them. This is the last of three widenings on the same day —
-- hours, then the due date, now authorship itself — and it supersedes the
-- original "only CRO Leader creates the report and tasks."
--
-- The report stays CRO-authored. Only the task list opens up: CRO Leader
-- still prescribes the work as a service, but the account can add what it
-- finds itself and correct what is written down.
--
-- Two changes, and one deliberate removal:
--
--   1. Insert widens from CRO-only to CRO plus the account's own
--      Owner/Admin, account-scoped the same way the update policy already
--      is. The account_id check matters — without it any Owner could file
--      tasks into another tenant.
--   2. prevent_task_definition_change() is dropped. It existed to confine
--      non-CRO roles to state and assignee; with Owner/Admin holding full
--      authorship and no other role able to update at all (see the update
--      policy), it now guards nothing. A trigger that always returns NEW is
--      worse than no trigger: it reads like a control that is still in force.
--
-- Archiving comes with authorship. archived_at was one of the guarded
-- columns, so dropping the trigger lets Owner/Admin retire a task — which
-- they need in order to undo one they added. Note this subtracts a completed
-- task's hours from the quarter's achieved figure, as it always has.
drop trigger if exists trg_gos_dashboard_tasks_definition on gos_dashboard_tasks;
drop function if exists prevent_task_definition_change();

drop policy if exists gos_dashboard_tasks_insert on gos_dashboard_tasks;
create policy gos_dashboard_tasks_insert on gos_dashboard_tasks for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );
