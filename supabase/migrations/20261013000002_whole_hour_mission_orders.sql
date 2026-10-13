-- Client-confirmed (2026-10-13): a mission order's hours are whole
-- numbers only, with no half-hour increments. The four orders carrying a
-- part hour round *up*, so no estimate shrinks (1.5 -> 2, 3.5 -> 4,
-- 6.5 -> 7). One of them is already complete; the achieved-hours trigger
-- applies the +0.5 to its quarter the same way it handles any edit.
--
-- The check keeps it that way for every writer, not only the app's forms,
-- which now step by 1 and round a typed part hour up.

update growth_mission_tasks set hours = ceil(hours) where hours <> trunc(hours);

alter table growth_mission_tasks
  add constraint growth_mission_tasks_whole_hours check (hours = trunc(hours));
