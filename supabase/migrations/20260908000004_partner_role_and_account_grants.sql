-- Client-confirmed addition (2026-09-08) — a new "partner" role for a
-- vendor/agency relationship distinct from CRO Leader: unlike
-- cro_admin/cro_advisor/cro_service_team (unconditional access to
-- every MSP account), a partner sees only the specific accounts they've
-- been explicitly granted. CRO Admin controls all grants unilaterally
-- (client-confirmed) — no MSP-side consent step in this pass.

-- 'partner' was added to user_role in a separate prior migration
-- (partner_role_enum_value) — Postgres forbids using a newly-added enum
-- value in the same transaction that adds it.

-- users_account_id_matches_role (§3, migration 20260831000001) treats
-- partner the same as the CRO Leader roles: no home account_id.
alter table users drop constraint users_account_id_matches_role;
alter table users add constraint users_account_id_matches_role check (
  (role in ('cro_admin','cro_advisor','cro_service_team','partner') and account_id is null)
  or
  (role in ('msp_owner','msp_admin','msp_sales','msp_marketing','msp_read_only') and account_id is not null)
);

create table partner_account_grants (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  granted_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (partner_user_id, account_id)
);
create index partner_account_grants_partner_user_id_idx on partner_account_grants(partner_user_id);
create index partner_account_grants_account_id_idx on partner_account_grants(account_id);

alter table partner_account_grants enable row level security;

-- A partner can see their own grant list (to know which accounts they
-- have); CRO Admin manages grants for everyone (the admin UI this
-- backs). No one else — not even the granted MSP account itself, per
-- the confirmed "CRO Admin decides unilaterally" model.
create policy partner_account_grants_select on partner_account_grants for select
  using (partner_user_id = auth.uid() or auth_has_any_role('cro_admin'));

create policy partner_account_grants_insert on partner_account_grants for insert
  with check (auth_has_any_role('cro_admin'));

create policy partner_account_grants_delete on partner_account_grants for delete
  using (auth_has_any_role('cro_admin'));

create or replace function is_partner_for(p_account_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from partner_account_grants
    where partner_user_id = auth.uid() and account_id = p_account_id
  );
$$;

-- ---- accounts ----
drop policy accounts_select on accounts;
create policy accounts_select on accounts for select
  using (id = auth_account_id() or is_cro_leader() or is_partner_for(id));

-- ---- companies ----
drop policy companies_select on companies;
create policy companies_select on companies for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy companies_insert on companies;
create policy companies_insert on companies for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy companies_update on companies;
create policy companies_update on companies for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- contact_statuses ----
drop policy contact_statuses_select on contact_statuses;
create policy contact_statuses_select on contact_statuses for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy contact_statuses_insert on contact_statuses;
create policy contact_statuses_insert on contact_statuses for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy contact_statuses_update on contact_statuses;
create policy contact_statuses_update on contact_statuses for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- contacts ----
drop policy contacts_select on contacts;
create policy contacts_select on contacts for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy contacts_insert on contacts;
create policy contacts_insert on contacts for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy contacts_update on contacts;
create policy contacts_update on contacts for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- lists ----
drop policy lists_select on lists;
create policy lists_select on lists for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy lists_insert on lists;
create policy lists_insert on lists for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy lists_update on lists;
create policy lists_update on lists for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- list_members (scoped via its parent list's account_id) ----
drop policy list_members_select on list_members;
create policy list_members_select on list_members for select
  using (exists (
    select 1 from lists l
    where l.id = list_members.list_id
      and (l.account_id = auth_account_id() or is_cro_leader() or is_partner_for(l.account_id))
  ));
drop policy list_members_insert on list_members;
create policy list_members_insert on list_members for insert
  with check (exists (
    select 1 from lists l
    where l.id = list_members.list_id
      and (
        (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
        or auth_has_any_role('cro_admin','cro_advisor')
        or is_partner_for(l.account_id)
      )
  ));
drop policy list_members_delete on list_members;
create policy list_members_delete on list_members for delete
  using (exists (
    select 1 from lists l
    where l.id = list_members.list_id
      and (
        (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
        or auth_has_any_role('cro_admin','cro_advisor')
        or is_partner_for(l.account_id)
      )
  ));

-- ---- opportunity_stages ----
drop policy opportunity_stages_select on opportunity_stages;
create policy opportunity_stages_select on opportunity_stages for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy opportunity_stages_insert on opportunity_stages;
create policy opportunity_stages_insert on opportunity_stages for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy opportunity_stages_update on opportunity_stages;
create policy opportunity_stages_update on opportunity_stages for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- opportunities ----
drop policy opportunities_select on opportunities;
create policy opportunities_select on opportunities for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy opportunities_insert on opportunities;
create policy opportunities_insert on opportunities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy opportunities_update on opportunities;
create policy opportunities_update on opportunities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- activities ----
drop policy activities_select on activities;
create policy activities_select on activities for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy activities_insert on activities;
create policy activities_insert on activities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy activities_update on activities;
create policy activities_update on activities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- campaigns ----
drop policy campaigns_select on campaigns;
create policy campaigns_select on campaigns for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
drop policy campaigns_insert on campaigns;
create policy campaigns_insert on campaigns for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );
drop policy campaigns_update on campaigns;
create policy campaigns_update on campaigns for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- ---- campaign_recipients, campaign_events (read-only, scoped via campaigns.account_id) ----
drop policy campaign_recipients_select on campaign_recipients;
create policy campaign_recipients_select on campaign_recipients for select
  using (exists (
    select 1 from campaigns c
    where c.id = campaign_recipients.campaign_id
      and (c.account_id = auth_account_id() or is_cro_leader() or is_partner_for(c.account_id))
  ));

drop policy campaign_events_select on campaign_events;
create policy campaign_events_select on campaign_events for select
  using (exists (
    select 1 from campaign_recipients cr
    join campaigns c on c.id = cr.campaign_id
    where cr.id = campaign_events.campaign_recipient_id
      and (c.account_id = auth_account_id() or is_cro_leader() or is_partner_for(c.account_id))
  ));

-- Deliberately unchanged: email_connections keeps no partner/CRO Leader
-- bypass at all (Backend Schema §6.3) — a connected mailbox and its
-- tokens are strictly the connecting user's own, regardless of role.
