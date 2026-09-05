-- Client-confirmed deviation from Backend Schema §5.1/§5.5 and Design
-- System §8.4: opportunity_stage was a fixed 13-value enum ("the literal
-- left-to-right pipeline from the Developer Brief §16.4"). The client
-- wants stages customizable per account, same shape as contact_statuses.
-- Each stage now carries a stage_group (open/won/lost) so the Kanban
-- board's column coloring and the closed_at-on-close logic (previously
-- keyed to the literal 'closed_won'/'closed_lost' enum values) still
-- work against an arbitrary custom stage name.

create type opportunity_stage_group as enum ('open', 'won', 'lost');

create table opportunity_stages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  name text not null,
  stage_group opportunity_stage_group not null default 'open',
  sort_order integer not null default 0,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunity_stages_account_id_idx on opportunity_stages(account_id);
create unique index opportunity_stages_account_name_unique
  on opportunity_stages(account_id, lower(name)) where archived_at is null;

create trigger trg_opportunity_stages_updated_at
  before update on opportunity_stages for each row execute function set_updated_at();

alter table opportunity_stages enable row level security;

create policy opportunity_stages_select on opportunity_stages for select
  using (account_id = auth_account_id() or is_cro_leader());

-- Owner/Admin only, matching contact_statuses (Backend Schema §6.4) --
-- pipeline configuration, not per-record CRUD every role touches.
create policy opportunity_stages_insert on opportunity_stages for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

create policy opportunity_stages_update on opportunity_stages for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

-- Seed every account (new and existing) with the original 13 stages as
-- an editable starting point, preserving the exact order/grouping from
-- the previous fixed enum so no existing data's meaning changes.
create or replace function seed_default_opportunity_stages(p_account_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.opportunity_stages (account_id, name, stage_group, sort_order, is_default) values
    (p_account_id, 'Identified Interest', 'open', 1, true),
    (p_account_id, 'Discovery Scheduled', 'open', 2, true),
    (p_account_id, 'Discovery Completed', 'open', 3, true),
    (p_account_id, 'Solution Alignment', 'open', 4, true),
    (p_account_id, 'Proposal Development', 'open', 5, true),
    (p_account_id, 'Proposal Delivered', 'open', 6, true),
    (p_account_id, 'Negotiation', 'open', 7, true),
    (p_account_id, 'Verbal Commitment', 'open', 8, true),
    (p_account_id, 'Contract Sent', 'open', 9, true),
    (p_account_id, 'Closed Won', 'won', 10, true),
    (p_account_id, 'Closed Lost', 'lost', 11, true),
    (p_account_id, 'Ghosted', 'lost', 12, true),
    (p_account_id, 'On Hold', 'lost', 13, true);
end;
$$;

create or replace function trg_seed_default_opportunity_stages_fn()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform seed_default_opportunity_stages(new.id);
  return new;
end;
$$;

create trigger trg_seed_default_opportunity_stages
  after insert on accounts
  for each row execute function trg_seed_default_opportunity_stages_fn();

-- Backfill every account that already exists (the trigger above only
-- fires on new accounts going forward).
do $$
declare
  acct record;
begin
  for acct in select id from accounts loop
    perform seed_default_opportunity_stages(acct.id);
  end loop;
end $$;

-- Auto-assign the lowest-sort-order active stage when an opportunity is
-- created without one, replacing the old column-level enum default —
-- there's no static default value anymore since stages are per-account.
create or replace function default_opportunity_stage()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.stage_id is null then
    select id into new.stage_id
    from opportunity_stages
    where account_id = new.account_id and archived_at is null
    order by sort_order asc
    limit 1;
  end if;
  return new;
end;
$$;

alter table opportunities add column stage_id uuid references opportunity_stages(id);

update opportunities o
set stage_id = os.id
from opportunity_stages os
where os.account_id = o.account_id
  and os.name = case o.stage
    when 'identified_interest' then 'Identified Interest'
    when 'discovery_scheduled' then 'Discovery Scheduled'
    when 'discovery_completed' then 'Discovery Completed'
    when 'solution_alignment' then 'Solution Alignment'
    when 'proposal_development' then 'Proposal Development'
    when 'proposal_delivered' then 'Proposal Delivered'
    when 'negotiation' then 'Negotiation'
    when 'verbal_commitment' then 'Verbal Commitment'
    when 'contract_sent' then 'Contract Sent'
    when 'closed_won' then 'Closed Won'
    when 'closed_lost' then 'Closed Lost'
    when 'ghosted' then 'Ghosted'
    when 'on_hold' then 'On Hold'
  end;

create trigger trg_default_opportunity_stage
  before insert on opportunities
  for each row execute function default_opportunity_stage();

alter table opportunities alter column stage_id set not null;
alter table opportunities drop column stage;
drop type opportunity_stage;
