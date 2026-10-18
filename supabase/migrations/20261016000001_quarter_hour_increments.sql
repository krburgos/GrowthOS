-- Client-confirmed (2026-10-16): hours are entered in quarter hours
-- everywhere, reversing the whole-hours rule of 2026-10-13
-- (20261013000002_whole_hour_mission_orders.sql).
--
-- numeric(n,1) cannot hold 0.25 — it would round to 0.3 — so each hours
-- column gains a second decimal, and a check keeps every value on a
-- quarter for every writer, not only the app's forms (which step by 0.25
-- and round a value in between up). Every existing value is whole or a
-- half, so nothing is rewritten.
--
-- account_team_assignments.weekly_hours is left alone: the per-discipline
-- allocation was removed from the Company Profile the same day and is no
-- longer written or read (every row was 0).
--
-- The quarter snapshot's hours columns widen to match, so a closed
-- quarter records quarter hours exactly. Its credits columns are still
-- integers, rounded at close; see Backend Schema §6.6j.

alter table growth_mission_tasks drop constraint growth_mission_tasks_whole_hours;
alter table growth_mission_tasks alter column hours type numeric(6,2);
alter table growth_mission_tasks
  add constraint growth_mission_tasks_quarter_hours check (hours * 4 = trunc(hours * 4));

alter table account_team_members alter column weekly_hours type numeric(5,2);
alter table account_team_members
  add constraint account_team_members_quarter_hours check (weekly_hours * 4 = trunc(weekly_hours * 4));

alter table growth_mission_quarter_snapshots
  alter column hours_required type numeric(8,2),
  alter column hours_available type numeric(8,2),
  alter column hours_completed type numeric(8,2);

-- sync_task_achieved_hours() still adds a completed order's hours here for
-- cro_account_portfolio() (Backend Schema §12), so it needs the same room.
alter table growth_mission_quarter_hours
  alter column committed_hours type numeric(7,2),
  alter column achieved_hours type numeric(7,2);
