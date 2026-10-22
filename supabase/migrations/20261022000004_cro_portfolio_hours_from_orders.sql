-- Bug fix (2026-10-22, found on the live CRO Leader dashboard, which read
-- "5 of 0 hrs"): cro_account_portfolio() still summed the hand-typed
-- growth_mission_quarter_hours that the 2026-10-13 Mission Capacity change
-- retired. Hours have been derived from Mission Orders since then, so the
-- dashboard and the Mission Cards disagreed.
--
-- This is the same rule as lib/growth-mission/capacity.ts, quarter in UTC
-- like currentQuarter():
--   required  — orders due this quarter (no due date counts as the last day
--               of the quarter), plus overdue orders still open or completed
--               this quarter;
--   committed — the required orders that have an owner, a roster member or
--               GrowthMission;
--   achieved  — orders completed this quarter.
-- The function's name and columns are unchanged, so the page needs nothing.

create or replace function public.cro_account_portfolio()
returns table (
  account_id uuid,
  questionnaire_complete boolean,
  vision_board_complete boolean,
  committed_hours numeric,
  achieved_hours numeric,
  last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select date_trunc('quarter', now() at time zone 'utc')::date as qs,
           (date_trunc('quarter', now() at time zone 'utc') + interval '3 months')::date as qn
  ), t as (
    select tk.account_id, tk.hours, tk.delegated, tk.assignee_id, tk.state::text as state, q.qs, q.qn,
           coalesce(tk.due_date, q.qn - 1) as due,
           (tk.state::text = 'complete' and tk.completed_at is not null
             and (tk.completed_at at time zone 'utc')::date >= q.qs
             and (tk.completed_at at time zone 'utc')::date < q.qn) as done_this_q
    from growth_mission_tasks tk cross join q
    where tk.archived_at is null
  ), r as (
    select account_id, hours, delegated, assignee_id, done_this_q,
           ((due >= qs and due < qn) or (due < qs and (state <> 'complete' or done_this_q))) as required
    from t
  )
  select
    a.id,
    exists (select 1 from growth_questionnaire_responses gq where gq.account_id = a.id and gq.completed_at is not null),
    exists (select 1 from vision_board_responses v where v.account_id = a.id and v.completed_at is not null),
    coalesce((select sum(r.hours) from r where r.account_id = a.id and r.required and (r.delegated or r.assignee_id is not null)), 0),
    coalesce((select sum(r.hours) from r where r.account_id = a.id and r.done_this_q), 0),
    (select max(x.occurred_at) from activities x where x.account_id = a.id and x.archived_at is null)
  from accounts a
  where a.archived_at is null
$$;
