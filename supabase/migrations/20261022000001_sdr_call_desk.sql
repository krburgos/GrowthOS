-- SDR Outreach Call Desk (client-confirmed, 2026-10-22, approved mockup
-- "Mission Card Workspaces" v2). The SDR Outreach Mission Card becomes the
-- place an SDR works: a Call Queue built from lists a CRO Admin assigns to
-- them, one-click call outcomes, and a daily scoreboard.
--
--   sdr_list_assignments — which SDR works which list. Only CRO Admin
--   assigns (client-confirmed). One SDR per list at a time, enforced by a
--   partial unique index; moving a list to another SDR updates the row,
--   and taking it off sets archived_at (soft delete, repo-wide rule).
--   A contact on two lists held by two SDRs shows in both queues; the
--   latest call by anyone decides when it is due, so it is never called
--   twice in a day (client-confirmed).
--
--   activities.call_outcome / follow_up_on — what a call ended in and when
--   to try again. Calls stay ordinary activities, so they show on Contact
--   Detail's timeline and in Reports as before.
--
-- SDRs use existing roles (client-confirmed): an in-house SDR is an MSP
-- Marketing user, an outsourced one a Partner granted the account. Both
-- can already insert activities and opportunities, so no policy on those
-- tables changes.
--
-- Grants are explicit: Supabase stops auto-granting new public tables to
-- the Data API on 2026-10-30.

create type sdr_call_outcome as enum ('no_answer', 'voicemail', 'connected', 'not_interested', 'meeting_booked');

alter table activities
  add column call_outcome sdr_call_outcome,
  add column follow_up_on date,
  add constraint activities_call_outcome_only_on_calls check (call_outcome is null or type = 'call');

-- The queue reads each contact's latest call, and its attempt count.
create index activities_contact_calls_idx
  on activities(contact_id, occurred_at desc)
  where type = 'call' and archived_at is null;

create table sdr_list_assignments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  list_id uuid not null references lists(id),
  sdr_user_id uuid not null references users(id),
  assigned_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index sdr_list_assignments_one_sdr_per_list
  on sdr_list_assignments(list_id) where archived_at is null;
create index sdr_list_assignments_account_idx
  on sdr_list_assignments(account_id, sdr_user_id) where archived_at is null;

create trigger trg_sdr_list_assignments_updated_at
  before update on sdr_list_assignments
  for each row execute function set_updated_at();

alter table sdr_list_assignments enable row level security;

create policy sdr_list_assignments_select on sdr_list_assignments for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

-- CRO Admin only, and only a list from the same account.
create policy sdr_list_assignments_insert on sdr_list_assignments for insert
  with check (
    auth_has_any_role('cro_admin')
    and exists (select 1 from lists l where l.id = list_id and l.account_id = sdr_list_assignments.account_id)
  );

create policy sdr_list_assignments_update on sdr_list_assignments for update
  using (auth_has_any_role('cro_admin'))
  with check (
    auth_has_any_role('cro_admin')
    and exists (select 1 from lists l where l.id = list_id and l.account_id = sdr_list_assignments.account_id)
  );

grant select, insert, update on public.sdr_list_assignments to authenticated, service_role;

-- Each SDR's daily target, set by CRO Leader (client-confirmed,
-- 2026-10-22). An SDR without a row uses the app default (60 calls,
-- 3 meetings, lib/sdr/desk.ts). archived_at per the repo-wide soft-delete
-- rule; changing a target updates the row in place.
create table sdr_daily_targets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  sdr_user_id uuid not null references users(id),
  calls integer not null default 60 check (calls between 0 and 1000),
  meetings integer not null default 3 check (meetings between 0 and 100),
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (account_id, sdr_user_id)
);

create trigger trg_sdr_daily_targets_updated_at
  before update on sdr_daily_targets
  for each row execute function set_updated_at();

alter table sdr_daily_targets enable row level security;

create policy sdr_daily_targets_select on sdr_daily_targets for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy sdr_daily_targets_insert on sdr_daily_targets for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy sdr_daily_targets_update on sdr_daily_targets for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

grant select, insert, update on public.sdr_daily_targets to authenticated, service_role;

-- The people who can be given a list, plus anyone already holding one (so
-- the scoreboard can name them). A partner has no home account and MSP
-- users cannot read partner rows in `users`, hence security definer; the
-- caller must be able to see the account itself.
create or replace function sdr_candidates(p_account_id uuid)
returns table (id uuid, full_name text, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.full_name, u.role
  from users u
  where (p_account_id = auth_account_id() or is_cro_leader() or is_partner_for(p_account_id))
    and u.archived_at is null
    and (
      (u.account_id = p_account_id and u.role = 'msp_marketing')
      or (u.role = 'partner' and exists (
        select 1 from partner_account_grants g where g.partner_user_id = u.id and g.account_id = p_account_id
      ))
      or exists (
        select 1 from sdr_list_assignments a
        where a.sdr_user_id = u.id and a.account_id = p_account_id and a.archived_at is null
      )
    )
  order by u.full_name;
$$;

grant execute on function sdr_candidates(uuid) to authenticated;

-- One SDR's Call Queue: every live contact on their assigned lists, once,
-- with the lists it came from and its latest call by anyone. Security
-- invoker, so RLS on every table read still applies. Whether a row is due
-- today is decided in the browser, which knows the viewer's own date.
create or replace function sdr_call_queue(p_account_id uuid, p_sdr_user_id uuid)
returns table (
  contact_id uuid,
  full_name text,
  title text,
  phone text,
  company_name text,
  company_phone text,
  company_size text,
  status_name text,
  status_color text,
  lists text[],
  attempts integer,
  last_outcome sdr_call_outcome,
  last_call_at timestamptz,
  follow_up_on date
)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select lm.contact_id, array_agg(distinct l.name order by l.name) as lists
    from sdr_list_assignments a
    join lists l on l.id = a.list_id and l.archived_at is null
    join list_members lm on lm.list_id = a.list_id
    where a.account_id = p_account_id
      and a.sdr_user_id = p_sdr_user_id
      and a.archived_at is null
    group by lm.contact_id
  )
  select
    c.id, c.full_name, c.title, c.phone,
    co.name, co.phone, co.company_size,
    s.name, s.color,
    m.lists,
    coalesce(calls.attempts, 0)::integer,
    last.call_outcome, last.occurred_at, last.follow_up_on
  from mine m
  join contacts c on c.id = m.contact_id and c.archived_at is null
  left join companies co on co.id = c.company_id
  left join contact_statuses s on s.id = c.status_id
  left join lateral (
    select count(*) as attempts
    from activities a
    where a.contact_id = c.id and a.type = 'call' and a.archived_at is null
  ) calls on true
  left join lateral (
    select a.call_outcome, a.occurred_at, a.follow_up_on
    from activities a
    where a.contact_id = c.id and a.type = 'call' and a.archived_at is null
    order by a.occurred_at desc
    limit 1
  ) last on true
  order by c.full_name;
$$;

grant execute on function sdr_call_queue(uuid, uuid) to authenticated;
