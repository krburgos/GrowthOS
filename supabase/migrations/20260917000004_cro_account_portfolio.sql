-- CRO Leader Dashboard portfolio stats (client-confirmed, 2026-09-17).
-- One round trip for the per-account status columns: whether each document
-- is complete, this quarter's hours, and the last activity date. security
-- invoker, so every underlying table's RLS still decides what the caller
-- can see — a CRO Leader role sees every account, a partner only the
-- accounts granted to them, an MSP user only their own.

create function cro_account_portfolio()
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
  select
    a.id,
    exists (select 1 from growth_questionnaire_responses r where r.account_id = a.id and r.completed_at is not null),
    exists (select 1 from vision_board_responses v where v.account_id = a.id and v.completed_at is not null),
    coalesce((select sum(h.committed_hours) from gos_dashboard_quarter_hours h
              where h.account_id = a.id and h.quarter_start = date_trunc('quarter', now())::date), 0),
    coalesce((select sum(h.achieved_hours) from gos_dashboard_quarter_hours h
              where h.account_id = a.id and h.quarter_start = date_trunc('quarter', now())::date), 0),
    (select max(x.occurred_at) from activities x where x.account_id = a.id and x.archived_at is null)
  from accounts a
  where a.archived_at is null
$$;
