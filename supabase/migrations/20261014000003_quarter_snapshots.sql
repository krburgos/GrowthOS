-- Client-confirmed (2026-10-14, approved mockup "Reports Redesign"): a
-- closed quarter's Mission figures are locked, not recalculated, so the
-- Reports page shows what the quarter actually looked like when it ended.
-- Backend Schema §6.6j.
--
-- One row per account per closed quarter. Written only by
-- snapshot_closed_quarters() (security definer), which pg_cron runs at
-- 00:05 UTC on the first day of each quarter. Reports also calls it for
-- its own account before reading, so a missed run repairs itself. Nobody
-- can write a figure directly: there are no insert/update/delete
-- policies, and the function only ever inserts rows that are missing.
--
-- The rules mirror lib/growth-mission/capacity.ts, evaluated as of the
-- quarter's close:
--   hours required   orders due in the quarter, plus earlier-due orders
--                    not finished before it started (AdvocateDash excluded)
--   hours available  the roster's weekly hours x 13, as it stands when the
--                    snapshot is taken (the roster keeps no history)
--   hours completed  orders completed in the quarter
--   credits          the same, GrowthMission (delegated) orders only, x 25
--   credits left     the running balance at the quarter's close; null when
--                    no allotment had been set by then
--   orders carried   required in the quarter and not finished by its end

create table growth_mission_quarter_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  quarter_start date not null
    check (extract(day from quarter_start) = 1 and extract(month from quarter_start) in (1, 4, 7, 10)),
  hours_required numeric(8,1) not null default 0,
  hours_available numeric(8,1) not null default 0,
  hours_completed numeric(8,1) not null default 0,
  credits_required integer not null default 0,
  credits_used integer not null default 0,
  credits_left integer,
  orders_completed integer not null default 0,
  orders_carried integer not null default 0,
  created_at timestamptz not null default now(),
  unique (account_id, quarter_start)
);

alter table growth_mission_quarter_snapshots enable row level security;

create policy growth_mission_quarter_snapshots_select on growth_mission_quarter_snapshots for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create or replace function snapshot_closed_quarters(p_account_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  last_closed date := (date_trunc('quarter', now() at time zone 'utc') - interval '3 months')::date;
  acct record;
  q_start date;
  q_next date;
  q_end date;
  first_month date;
  granted integer;
  inserted integer := 0;
begin
  -- A signed-in caller may only snapshot an account they can see. The
  -- scheduled run (no auth.uid) covers every account.
  if auth.uid() is not null then
    if p_account_id is null
       or not (p_account_id = auth_account_id() or is_cro_leader() or is_partner_for(p_account_id)) then
      raise exception 'Not authorized to snapshot this account.' using errcode = '42501';
    end if;
  end if;

  for acct in
    select id, date_trunc('quarter', created_at at time zone 'utc')::date as first_q
    from accounts
    where p_account_id is null or id = p_account_id
  loop
    q_start := acct.first_q;
    while q_start <= last_closed loop
      if not exists (
        select 1 from growth_mission_quarter_snapshots s where s.account_id = acct.id and s.quarter_start = q_start
      ) then
        q_next := (q_start + interval '3 months')::date;
        q_end := q_next - 1;

        select min(effective_month) into first_month
        from account_credit_allotments where account_id = acct.id and effective_month <= q_end;

        granted := null;
        if first_month is not null then
          select coalesce(sum((
            select a.monthly_credits from account_credit_allotments a
            where a.account_id = acct.id and a.effective_month <= m::date
            order by a.effective_month desc limit 1
          )), 0)
          into granted
          from generate_series(first_month, (q_next - interval '1 month')::date, interval '1 month') as m;
        end if;

        insert into growth_mission_quarter_snapshots (
          account_id, quarter_start, hours_required, hours_available, hours_completed,
          credits_required, credits_used, credits_left, orders_completed, orders_carried
        )
        select
          acct.id,
          q_start,
          coalesce(sum(t.hours) filter (where t.required), 0),
          coalesce((select sum(m.weekly_hours) from account_team_members m
                    where m.account_id = acct.id and m.archived_at is null), 0) * 13,
          coalesce(sum(t.hours) filter (where t.done_in_q), 0),
          (coalesce(sum(t.hours) filter (where t.required and t.delegated), 0) * 25)::integer,
          (coalesce(sum(t.hours) filter (where t.done_in_q and t.delegated), 0) * 25)::integer,
          case when granted is null then null
               else granted - (coalesce(sum(t.hours) filter (
                      where t.delegated and t.done_day is not null and t.done_day >= first_month and t.done_day < q_next
                    ), 0) * 25)::integer
          end,
          count(*) filter (where t.done_in_q)::integer,
          count(*) filter (where t.required and not t.done_by_end)::integer
        from (
          select
            o.hours,
            o.delegated,
            o.done_day,
            (o.done_day is not null and o.done_day >= q_start and o.done_day < q_next) as done_in_q,
            (o.done_day is not null and o.done_day < q_next) as done_by_end,
            (o.due >= q_start and o.due < q_next)
              or (o.due < q_start and not (o.done_day is not null and o.done_day < q_start)) as required
          from (
            select
              gt.hours,
              gt.delegated,
              coalesce(gt.due_date, q_end) as due,
              -- A complete order with no stamp counts as done before anything.
              case when gt.state = 'complete' then coalesce((gt.completed_at at time zone 'utc')::date, date '1900-01-01') end as done_day
            from growth_mission_tasks gt
            where gt.account_id = acct.id
              and gt.archived_at is null
              and gt.step_slug::text <> 'advocate-dash'
              and gt.created_at < q_next
          ) o
        ) t
        on conflict (account_id, quarter_start) do nothing;

        inserted := inserted + 1;
      end if;
      q_start := (q_start + interval '3 months')::date;
    end loop;
  end loop;

  return inserted;
end;
$$;

revoke all on function snapshot_closed_quarters(uuid) from public;
grant execute on function snapshot_closed_quarters(uuid) to authenticated;

-- Backfill every quarter that has already closed.
select snapshot_closed_quarters();

-- 00:05 UTC on 1 January, April, July and October.
select cron.schedule(
  'growth-mission-quarter-snapshots',
  '5 0 1 1,4,7,10 *',
  $$ select snapshot_closed_quarters(); $$
);
