-- Client-confirmed (2026-10-30, approved mockup "SniperLeads Reports Mockup"):
-- a monthly SniperLeads report for each SniperLeads client, prepared on the
-- CRO Leader Dashboard by CRO Admin / CRO Advisor and exported (copied for
-- Outlook or downloaded as a PDF). GrowthMission never sends it.
--
-- sniperleads_clients: which clients get a report and since when. CRO Admin
-- sets it; it is CRO Leader's own record, so clients never see it.
-- sniperleads_reports: one row per client per month, holding the outreach
-- numbers typed in by CRO Leader and, once exported, a snapshot of the GM
-- numbers so a past month never changes.
--
-- Nothing is hard-deleted (no DELETE policies); a client is switched off
-- with active = false.

create table sniperleads_clients (
  account_id uuid primary key references accounts(id) on delete cascade,
  start_month date not null check (extract(day from start_month) = 1),
  active boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sniperleads_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  emails_sent integer check (emails_sent >= 0),
  real_replies integer check (real_replies >= 0),
  auto_replies integer check (auto_replies >= 0),
  calls integer check (calls >= 0),
  ad_audience integer check (ad_audience >= 0),
  linkedin_started boolean not null default false,
  linkedin_invites integer check (linkedin_invites >= 0),
  linkedin_messages integer check (linkedin_messages >= 0),
  website_started boolean not null default false,
  website_visits integer check (website_visits >= 0),
  intro text check (intro is null or char_length(intro) <= 2000),
  closing text check (closing is null or char_length(closing) <= 500),
  signer_id uuid references users(id) on delete set null,
  -- Set on export: the GM numbers as they were, so the report never shifts.
  gm_numbers jsonb,
  exported_at timestamptz,
  exported_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, month)
);

create index sniperleads_reports_month_idx on sniperleads_reports (month);

create trigger trg_sniperleads_clients_updated_at before update on sniperleads_clients
  for each row execute function set_updated_at();
create trigger trg_sniperleads_reports_updated_at before update on sniperleads_reports
  for each row execute function set_updated_at();

alter table sniperleads_clients enable row level security;
alter table sniperleads_reports enable row level security;

create policy sniperleads_clients_select on sniperleads_clients for select
  using (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy sniperleads_clients_insert on sniperleads_clients for insert
  with check (auth_has_any_role('cro_admin'));
create policy sniperleads_clients_update on sniperleads_clients for update
  using (auth_has_any_role('cro_admin'))
  with check (auth_has_any_role('cro_admin'));

create policy sniperleads_reports_select on sniperleads_reports for select
  using (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy sniperleads_reports_insert on sniperleads_reports for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy sniperleads_reports_update on sniperleads_reports for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'))
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));

grant select, insert, update on sniperleads_clients to authenticated;
grant select, insert, update on sniperleads_reports to authenticated;
grant all on sniperleads_clients to service_role;
grant all on sniperleads_reports to service_role;

-- The numbers GrowthMission counts itself, for one client, as they stand now.
-- Security invoker: RLS decides what the caller can count (CRO roles see
-- every account). Stage thresholds are found by name in that client's own
-- pipeline, so a client that renamed a stage just counts 0 there.
--   pool          contacts in the client's active lists
--   flagged       contacts with the SNIPER status
--   opportunities SniperLead opportunities
--   meetings      SniperLead opportunities at FME Scheduled or later (not lost)
--   proposals     SniperLead opportunities at Proposal Emailed or later (not lost)
--   won           SniperLead opportunities in a won stage
create or replace function sniperleads_numbers(p_account_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with opps as (
    select o.id, s.sort_order, s.stage_group
    from opportunities o
    join opportunity_stages s on s.id = o.stage_id
    where o.account_id = p_account_id and o.type = 'SniperLead' and o.archived_at is null
  ),
  marks as (
    select
      (select sort_order from opportunity_stages where account_id = p_account_id and name = 'FME Scheduled' and archived_at is null limit 1) as fme,
      (select sort_order from opportunity_stages where account_id = p_account_id and name = 'Proposal Emailed' and archived_at is null limit 1) as proposal
  )
  select jsonb_build_object(
    'pool', (
      select count(distinct lm.contact_id)
      from list_members lm
      join lists l on l.id = lm.list_id and l.archived_at is null
      join contacts c on c.id = lm.contact_id and c.archived_at is null
      where l.account_id = p_account_id
    ),
    'flagged', (
      select count(*)
      from contacts c
      join contact_statuses cs on cs.id = c.status_id
      where c.account_id = p_account_id and c.archived_at is null and upper(cs.name) = 'SNIPER'
    ),
    'opportunities', (select count(*) from opps),
    'meetings', (select count(*) from opps, marks where marks.fme is not null and opps.sort_order >= marks.fme and opps.stage_group <> 'lost'),
    'proposals', (select count(*) from opps, marks where marks.proposal is not null and opps.sort_order >= marks.proposal and opps.stage_group <> 'lost'),
    'won', (select count(*) from opps where stage_group = 'won')
  );
$$;

grant execute on function sniperleads_numbers(uuid) to authenticated, service_role;

-- The current SniperLeads clients and when each started, from CRO Leader's
-- client roster ("Months in" as of October 2026; code S or TS).
insert into sniperleads_clients (account_id, start_month)
select a.id, v.start_month::date
from (values
  ('Prosper Solutions', '2026-01-01'),
  ('CMIT Solutions of North Fulton', '2026-06-01'),
  ('ProTech Office IT', '2026-06-01'),
  ('Powerful IT Systems', '2026-07-01'),
  ('TheConnection', '2026-07-01'),
  ('Iron Wolf Technology', '2026-07-01'),
  ('Keene Systems', '2026-07-01'),
  ('MTRIX America Inc. Authentication Solutions', '2026-08-01'),
  ('Team Logic IT - New York, NY', '2026-09-01'),
  ('Top7', '2026-09-01'),
  ('Team Logic IT - North Alabama', '2026-10-01')
) as v(name, start_month)
join accounts a on a.name = v.name and a.archived_at is null
on conflict (account_id) do nothing;
