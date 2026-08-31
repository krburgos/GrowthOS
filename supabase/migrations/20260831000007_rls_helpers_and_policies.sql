-- Backend Schema Document §6 — Row Level Security Policies

-- §6.1 Helper Functions
create or replace function auth_account_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select account_id from public.users where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function is_cro_leader()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth_role() in ('cro_admin', 'cro_advisor', 'cro_service_team');
$$;

create or replace function auth_has_any_role(variadic roles user_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth_role() = any(roles);
$$;

-- §6.2 accounts, users
alter table accounts enable row level security;

create policy accounts_select on accounts for select
  using (id = auth_account_id() or is_cro_leader());

create policy accounts_update on accounts for update
  using (
    (id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table users enable row level security;

create policy users_select on users for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy users_update on users for update
  using (
    id = auth.uid()
    or (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin')
  );

-- §6.3 email_connections
alter table email_connections enable row level security;

create policy email_connections_select on email_connections for select
  using (user_id = auth.uid());

create policy email_connections_insert on email_connections for insert
  with check (user_id = auth.uid());

create policy email_connections_update on email_connections for update
  using (user_id = auth.uid());

-- §6.4 companies, contact_statuses, contacts
alter table companies enable row level security;

create policy companies_select on companies for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy companies_insert on companies for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy companies_update on companies for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table contact_statuses enable row level security;

create policy contact_statuses_select on contact_statuses for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy contact_statuses_insert on contact_statuses for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy contact_statuses_update on contact_statuses for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table contacts enable row level security;

create policy contacts_select on contacts for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy contacts_insert on contacts for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy contacts_update on contacts for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

-- §6.5 lists, list_members, opportunities, activities
alter table lists enable row level security;

create policy lists_select on lists for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy lists_insert on lists for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy lists_update on lists for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table list_members enable row level security;

create policy list_members_select on list_members for select
  using (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (l.account_id = auth_account_id() or is_cro_leader())
    )
  );

create policy list_members_insert on list_members for insert
  with check (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
          or auth_has_any_role('cro_admin','cro_advisor')
        )
    )
  );

create policy list_members_delete on list_members for delete
  using (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
          or auth_has_any_role('cro_admin','cro_advisor')
        )
    )
  );

alter table opportunities enable row level security;

create policy opportunities_select on opportunities for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy opportunities_insert on opportunities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy opportunities_update on opportunities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table activities enable row level security;

create policy activities_select on activities for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy activities_insert on activities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy activities_update on activities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

-- §6.6 campaigns, campaign_recipients, campaign_events
alter table campaigns enable row level security;

create policy campaigns_select on campaigns for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy campaigns_insert on campaigns for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy campaigns_update on campaigns for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table campaign_recipients enable row level security;

create policy campaign_recipients_select on campaign_recipients for select
  using (
    exists (
      select 1 from campaigns c where c.id = campaign_recipients.campaign_id
        and (c.account_id = auth_account_id() or is_cro_leader())
    )
  );

alter table campaign_events enable row level security;

create policy campaign_events_select on campaign_events for select
  using (
    exists (
      select 1 from campaign_recipients cr
        join campaigns c on c.id = cr.campaign_id
        where cr.id = campaign_events.campaign_recipient_id
        and (c.account_id = auth_account_id() or is_cro_leader())
    )
  );
