-- Client-confirmed (2026-10-13, approved mockup "Mission Dashboards" v5):
-- Workstream hours becomes Mission Capacity, which adds credits alongside
-- hours. Two schema changes support it.
--
-- 1. Credits. An account's credits are a running balance: a monthly
--    allotment is added on the 1st of every month, unused credits roll
--    over, and each completed mission order spends 25 credits per hour
--    (one credit = $1, at $25 an hour). Nothing here stores the balance
--    or the spend - both are derived from this table and from completed
--    tasks (lib/growth-mission/capacity.ts), so there is no second ledger
--    that can drift from the tasks it describes.
--
--    One row per account per month the allotment *changed*. The allotment
--    in force for any month is the latest row on or before it, so an edit
--    applies from the month it is made without rewriting earlier months.
--    CRO Leader types it for now; subscription tiers are expected to fill
--    the same figure later.
--
-- 2. Due dates. A mission order's due date now defaults to the last day
--    of the quarter it is created in, and the existing undated ones take
--    the current quarter's end. Hours Required counts orders by due date,
--    so an undated order would otherwise belong to no quarter at all.

create table account_credit_allotments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  -- Always the first of a month.
  effective_month date not null check (effective_month = date_trunc('month', effective_month)::date),
  monthly_credits integer not null check (monthly_credits >= 0),
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, effective_month)
);

create index account_credit_allotments_account_id_idx on account_credit_allotments(account_id);

alter table account_credit_allotments enable row level security;

-- Everyone on the account sees the credits (client-confirmed); only CRO
-- Leader sets them. No delete policy: a later row supersedes an earlier
-- one, and the history is what the rollover is computed from.
create policy account_credit_allotments_select on account_credit_allotments for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy account_credit_allotments_insert on account_credit_allotments for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy account_credit_allotments_update on account_credit_allotments for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

grant select, insert, update on account_credit_allotments to authenticated, service_role;

create trigger trg_account_credit_allotments_updated_at before update on account_credit_allotments
  for each row execute function set_updated_at();

alter table growth_mission_tasks
  alter column due_date set default ((date_trunc('quarter', now()) + interval '3 months' - interval '1 day')::date);

update growth_mission_tasks
  set due_date = (date_trunc('quarter', now()) + interval '3 months' - interval '1 day')::date
  where due_date is null;
