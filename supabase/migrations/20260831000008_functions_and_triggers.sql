-- Backend Schema Document §7 — Database Functions & Triggers

-- §7.1 updated_at maintenance
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_accounts_updated_at before update on accounts for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users for each row execute function set_updated_at();
create trigger trg_email_connections_updated_at before update on email_connections for each row execute function set_updated_at();
create trigger trg_companies_updated_at before update on companies for each row execute function set_updated_at();
create trigger trg_contact_statuses_updated_at before update on contact_statuses for each row execute function set_updated_at();
create trigger trg_contacts_updated_at before update on contacts for each row execute function set_updated_at();
create trigger trg_lists_updated_at before update on lists for each row execute function set_updated_at();
create trigger trg_opportunities_updated_at before update on opportunities for each row execute function set_updated_at();
create trigger trg_activities_updated_at before update on activities for each row execute function set_updated_at();
create trigger trg_campaigns_updated_at before update on campaigns for each row execute function set_updated_at();
create trigger trg_campaign_recipients_updated_at before update on campaign_recipients for each row execute function set_updated_at();

-- §7.2 Auth lifecycle: handle_new_user, sync_user_email, prevent_self_role_escalation
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, account_id, role, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'account_id', '')::uuid,
    (new.raw_user_meta_data->>'role')::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function sync_user_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.users set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

create trigger trg_sync_user_email
  after update of email on auth.users
  for each row execute function sync_user_email();

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.id
     and (new.role is distinct from old.role or new.account_id is distinct from old.account_id)
     and not auth_has_any_role('msp_owner', 'msp_admin', 'cro_admin') then
    raise exception 'You cannot change your own role or account.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
  before update on users
  for each row execute function prevent_self_role_escalation();

create or replace function get_users_with_last_login(p_account_id uuid default null)
returns table(user_id uuid, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if p_account_id is not null and p_account_id != auth_account_id() and not is_cro_leader() then
    raise exception 'Not authorized to view this account''s users.';
  end if;
  return query
    select u.id, au.last_sign_in_at
    from public.users u
    join auth.users au on au.id = u.id
    where (p_account_id is null or u.account_id = p_account_id)
      and (u.account_id = auth_account_id() or is_cro_leader());
end;
$$;

-- §7.3 Company matching: normalize_company_domain, match_or_create_company, merge_companies
create or replace function normalize_company_domain()
returns trigger
language plpgsql
as $$
begin
  if new.domain is not null then
    new.domain := lower(regexp_replace(trim(new.domain), '^(https?://)?(www\.)?', ''));
    new.domain := split_part(new.domain, '/', 1);
    if new.domain = '' then
      new.domain := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_normalize_company_domain
  before insert or update of domain on companies
  for each row execute function normalize_company_domain();

create or replace function match_or_create_company(
  p_account_id uuid,
  p_name text,
  p_domain text default null
)
returns uuid
language plpgsql security invoker
as $$
declare
  v_domain text;
  v_company_id uuid;
begin
  if p_domain is not null then
    v_domain := lower(regexp_replace(trim(p_domain), '^(https?://)?(www\.)?', ''));
    v_domain := split_part(v_domain, '/', 1);
    if v_domain = '' then v_domain := null; end if;
  end if;

  if v_domain is not null then
    select id into v_company_id from companies
      where account_id = p_account_id and domain = v_domain and archived_at is null
      limit 1;
  end if;

  if v_company_id is null then
    insert into companies (account_id, name, domain)
    values (p_account_id, p_name, v_domain)
    returning id into v_company_id;
  end if;

  return v_company_id;
end;
$$;

create or replace function merge_companies(
  p_source_company_id uuid,
  p_target_company_id uuid
)
returns void
language plpgsql security invoker
as $$
begin
  update contacts set company_id = p_target_company_id where company_id = p_source_company_id;
  update opportunities set company_id = p_target_company_id where company_id = p_source_company_id;
  update companies set archived_at = now() where id = p_source_company_id;
end;
$$;

-- §7.4 Opportunity/list mechanics
create or replace function sync_opportunity_company()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id from contacts where id = new.contact_id;
  return new;
end;
$$;

create trigger trg_sync_opportunity_company
  before insert or update of contact_id on opportunities
  for each row execute function sync_opportunity_company();

create or replace function enforce_static_list_membership()
returns trigger
language plpgsql
as $$
declare
  v_type list_type;
begin
  select type into v_type from lists where id = new.list_id;
  if v_type <> 'static' then
    raise exception 'Contacts can only be added directly to static lists; smart lists compute their members live.';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_static_list_membership
  before insert on list_members
  for each row execute function enforce_static_list_membership();

create or replace function compute_smart_list_members(p_list_id uuid)
returns table(contact_id uuid)
language plpgsql security invoker
as $$
declare
  v_criteria jsonb;
  v_account_id uuid;
  v_match text;
  v_condition jsonb;
  v_field text;
  v_op text;
  v_value text;
  v_sql_field text;
  v_sql_op text;
  v_clause text;
  v_clauses text[] := array[]::text[];
  v_join_word text;
  v_where text;
begin
  select criteria, account_id into v_criteria, v_account_id from lists where id = p_list_id and type = 'smart';
  if v_criteria is null then
    raise exception 'List % is not a smart list or has no criteria', p_list_id;
  end if;

  v_match := coalesce(v_criteria->>'match', 'all');
  v_join_word := case when v_match = 'any' then ' or ' else ' and ' end;

  for v_condition in select * from jsonb_array_elements(v_criteria->'conditions') loop
    v_field := v_condition->>'field';
    v_op := v_condition->>'op';
    v_value := v_condition->>'value';

    v_sql_field := case v_field
      when 'status_id' then 'status_id'
      when 'owner_id' then 'owner_id'
      when 'company_id' then 'company_id'
      when 'source' then 'source::text'
      when 'title' then 'title'
      when 'email' then 'email'
      when 'created_at' then 'created_at'
      else null
    end;
    if v_sql_field is null then
      raise exception 'Smart list condition references an unsupported field: %', v_field;
    end if;

    v_sql_op := case v_op
      when 'eq' then '='
      when 'neq' then '<>'
      when 'contains' then 'ilike'
      when 'before' then '<'
      when 'after' then '>'
      else null
    end;
    if v_sql_op is null then
      raise exception 'Smart list condition uses an unsupported operator: %', v_op;
    end if;

    if v_op = 'contains' then
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, '%' || v_value || '%');
    else
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, v_value);
    end if;

    v_clauses := array_append(v_clauses, v_clause);
  end loop;

  if array_length(v_clauses, 1) is null then
    v_where := 'true';
  else
    v_where := array_to_string(v_clauses, v_join_word);
  end if;

  return query execute format(
    'select id from contacts where account_id = %L and archived_at is null and (%s)',
    v_account_id, v_where
  );
end;
$$;

-- §7.5 Account setup: seed_default_contact_statuses
create or replace function seed_default_contact_statuses()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  defaults text[] := array[
    'Suspect', 'Prospect', 'Market Qualified Contact', 'Contacted', 'Engaged',
    'Appointment Scheduled', 'Discovery Completed', 'Opportunity Created',
    'Proposal Delivered', 'Negotiation', 'Client Won', 'Lost', 'Ghosted', 'Nurture'
  ];
  status_name text;
  i integer := 0;
begin
  foreach status_name in array defaults loop
    insert into public.contact_statuses (account_id, name, sort_order, is_default)
    values (new.id, status_name, i, true);
    i := i + 1;
  end loop;
  return new;
end;
$$;

create trigger trg_seed_default_contact_statuses
  after insert on accounts
  for each row execute function seed_default_contact_statuses();

-- §7.6 Campaign tracking: record_campaign_event, send_due_campaigns
create or replace function record_campaign_event(
  p_tracking_token uuid,
  p_event_type campaign_event_type,
  p_metadata jsonb default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_recipient_id uuid;
begin
  select id into v_recipient_id from campaign_recipients where tracking_token = p_tracking_token;
  if v_recipient_id is null then
    return;
  end if;

  insert into campaign_events (campaign_recipient_id, event_type, metadata)
  values (v_recipient_id, p_event_type, p_metadata);

  update campaign_recipients set
    status = case
      when p_event_type = 'bounced' then 'bounced'
      when p_event_type = 'unsubscribed' then 'unsubscribed'
      when p_event_type in ('sent', 'delivered') and status = 'pending' then 'sent'
      else status
    end,
    sent_at = case when p_event_type = 'sent' and sent_at is null then now() else sent_at end,
    first_opened_at = case when p_event_type = 'opened' and first_opened_at is null then now() else first_opened_at end,
    first_clicked_at = case when p_event_type = 'clicked' and first_clicked_at is null then now() else first_clicked_at end,
    bounced_at = case when p_event_type = 'bounced' and bounced_at is null then now() else bounced_at end,
    unsubscribed_at = case when p_event_type = 'unsubscribed' and unsubscribed_at is null then now() else unsubscribed_at end,
    open_count = open_count + case when p_event_type = 'opened' then 1 else 0 end,
    click_count = click_count + case when p_event_type = 'clicked' then 1 else 0 end,
    updated_at = now()
  where id = v_recipient_id;

  if p_event_type = 'unsubscribed' then
    update contacts set email_opt_out = true
      where id = (select contact_id from campaign_recipients where id = v_recipient_id);
  end if;
end;
$$;

create or replace function send_due_campaigns()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign record;
  v_app_url text := current_setting('app.settings.app_url', true);
  v_cron_secret text := current_setting('app.settings.cron_secret', true);
begin
  for v_campaign in
    select id from campaigns
    where status = 'scheduled' and scheduled_at <= now()
    for update skip locked
  loop
    update campaigns set status = 'sending' where id = v_campaign.id;

    perform net.http_post(
      url := v_app_url || '/api/campaigns/send-due',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
      body := jsonb_build_object('campaign_id', v_campaign.id)
    );
  end loop;
end;
$$;
