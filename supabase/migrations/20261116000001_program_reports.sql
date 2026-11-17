-- Program Reports in Intel (client-confirmed 2026-11-16, approved mockup
-- "Program Reports Mockup"; docs/superpowers/specs/2026-11-16-program-reports-design.md).
--
-- 1. account_programs: which CRO Leader programs an account subscribes to.
--    One record for every program, replacing sniperleads_clients (copied in
--    below and left in place, unused — nothing is hard-deleted). The account
--    can read its own rows so Intel knows which tabs to show; only CRO Admin
--    switches programs on or off.
-- 2. tactical_reports: the TacticalLeads monthly numbers CRO Leader types in,
--    published to the client's Intel. Clients read published rows only.
-- 3. sniperleads_reports: Publish to Intel, same rule.
-- 4. tactical_numbers(): MQCs added in a month, counted by GrowthMission.

-- ---- 1. account_programs ----------------------------------------------

create table account_programs (
  account_id uuid not null references accounts(id) on delete cascade,
  program text not null check (program in ('sniper_leads', 'tactical_leads')),
  start_month date not null check (extract(day from start_month) = 1),
  active boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, program)
);

create trigger trg_account_programs_updated_at before update on account_programs
  for each row execute function set_updated_at();

alter table account_programs enable row level security;

create policy account_programs_select on account_programs for select
  using ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id));
create policy account_programs_insert on account_programs for insert
  with check ((select auth_has_any_role('cro_admin')));
create policy account_programs_update on account_programs for update
  using ((select auth_has_any_role('cro_admin')))
  with check ((select auth_has_any_role('cro_admin')));

insert into account_programs (account_id, program, start_month, active, updated_by, created_at, updated_at)
select account_id, 'sniper_leads', start_month, active, updated_by, created_at, updated_at
from sniperleads_clients
on conflict (account_id, program) do nothing;

comment on table sniperleads_clients is
  'Superseded 2026-11-16 by account_programs (program = sniper_leads). Kept, unused.';

grant select, insert, update on account_programs to authenticated;
grant all on account_programs to service_role;

-- ---- 2. tactical_reports ----------------------------------------------

create table tactical_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  -- Email Campaigns
  emails_sent integer check (emails_sent >= 0),
  opens integer check (opens >= 0),
  clicks integer check (clicks >= 0),
  real_replies integer check (real_replies >= 0),
  -- Email Warmup (percentages, one decimal)
  inbox_placement numeric(4,1) check (inbox_placement between 0 and 100),
  delivered_rate numeric(4,1) check (delivered_rate between 0 and 100),
  bounce_rate numeric(4,1) check (bounce_rate between 0 and 100),
  mailboxes_warmed integer check (mailboxes_warmed >= 0),
  -- Live Activity Monitoring
  alerts_sent integer check (alerts_sent >= 0),
  alerts_opened integer check (alerts_opened >= 0),
  alerts_clicked integer check (alerts_clicked >= 0),
  alerts_replied integer check (alerts_replied >= 0),
  alerts_visited integer check (alerts_visited >= 0),
  -- LinkedIn
  linkedin_invites integer check (linkedin_invites >= 0),
  linkedin_accepted integer check (linkedin_accepted >= 0),
  linkedin_messages integer check (linkedin_messages >= 0),
  linkedin_replies integer check (linkedin_replies >= 0),
  -- Set at first publish: the numbers GrowthMission counted, so the month never shifts.
  gm_numbers jsonb,
  published_at timestamptz,
  published_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, month)
);

create trigger trg_tactical_reports_updated_at before update on tactical_reports
  for each row execute function set_updated_at();

alter table tactical_reports enable row level security;

create policy tactical_reports_select on tactical_reports for select
  using (
    (select auth_has_any_role('cro_admin', 'cro_advisor'))
    or (published_at is not null
        and ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id)))
  );
create policy tactical_reports_insert on tactical_reports for insert
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));
create policy tactical_reports_update on tactical_reports for update
  using ((select auth_has_any_role('cro_admin', 'cro_advisor')))
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));

grant select, insert, update on tactical_reports to authenticated;
grant all on tactical_reports to service_role;

-- ---- 3. sniperleads_reports: Publish to Intel -------------------------

alter table sniperleads_reports
  add column published_at timestamptz,
  add column published_by uuid references users(id) on delete set null;

-- A second SELECT policy; Postgres ORs it with sniperleads_reports_select.
create policy sniperleads_reports_select_published on sniperleads_reports for select
  using (
    published_at is not null
    and ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id))
  );

-- ---- 4. tactical_numbers() --------------------------------------------

-- MQCs added: distinct live contacts added to the account's live lists
-- during the month (UTC). Security invoker: RLS decides what the caller
-- can count.
create or replace function tactical_numbers(p_account_id uuid, p_month date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'mqcs', (
      select count(distinct lm.contact_id)
      from list_members lm
      join lists l on l.id = lm.list_id and l.archived_at is null
      join contacts c on c.id = lm.contact_id and c.archived_at is null
      where l.account_id = p_account_id
        and lm.added_at >= p_month::timestamp at time zone 'UTC'
        and lm.added_at < (p_month + interval '1 month')::timestamp at time zone 'UTC'
    )
  );
$$;

grant execute on function tactical_numbers(uuid, date) to authenticated, service_role;
