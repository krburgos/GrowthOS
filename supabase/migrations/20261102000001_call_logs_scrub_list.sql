-- Client-confirmed (2026-11-02, approved mockup "Call Logs and Scrub List
-- Mockup"): a Bad number call outcome, bad-number tags on the contact's
-- direct line and the company's main line, and an automatic Scrub List.
--
-- Logging Bad number asks which number failed (Direct, Company or Both).
-- That number is tagged so nobody dials it again. When no good number is
-- left, the contact leaves every list on the account and joins the
-- account's Scrub List, a normal list that can be assigned like any other.
-- Whoever works it fixes the details and sends the contact back to the
-- lists it came from, or marks it "Can't find it". Contacts are never
-- deleted; leaving a list removes the list_members row, as Lists already does.
--
-- Run as one script in the SQL Editor. The new enum value is added first
-- and not used anywhere else in this script.

alter type sdr_call_outcome add value if not exists 'bad_number';

-- ---- Bad-number tags -------------------------------------------------
alter table contacts add column phone_bad_at timestamptz;
alter table companies add column phone_bad_at timestamptz;

-- A new number is a new chance: changing the phone clears its tag.
create or replace function clear_bad_phone_on_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_bad_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_contacts_clear_bad_phone before update on contacts
  for each row execute function clear_bad_phone_on_change();
create trigger trg_companies_clear_bad_phone before update on companies
  for each row execute function clear_bad_phone_on_change();

-- ---- The Scrub List --------------------------------------------------
alter table lists add column is_scrub boolean not null default false;
create unique index lists_one_scrub_per_account on lists (account_id) where is_scrub and archived_at is null;

-- It always exists once made: it can't be renamed or archived.
create or replace function guard_scrub_list()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_scrub and (new.name is distinct from old.name or new.archived_at is not null or not new.is_scrub) then
    raise exception 'The Scrub List can''t be renamed or deleted.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_lists_guard_scrub before update on lists
  for each row execute function guard_scrub_list();

-- Why a contact was scrubbed, where it came from, and how it was resolved.
create table scrub_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  which text not null check (which in ('direct', 'company', 'both')),
  from_list_ids uuid[] not null default '{}',
  scrubbed_by uuid references users(id) on delete set null,
  scrubbed_at timestamptz not null default now(),
  resolution text check (resolution in ('sent_back', 'unverified')),
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scrub_entries_open_idx on scrub_entries (account_id, contact_id) where resolved_at is null;

create trigger trg_scrub_entries_updated_at before update on scrub_entries
  for each row execute function set_updated_at();

alter table scrub_entries enable row level security;

-- Read like the account's lists; written only through the two functions below.
create policy scrub_entries_select on scrub_entries for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

grant select on scrub_entries to authenticated;
grant all on scrub_entries to service_role;

-- Who may log calls and edit contacts on an account: the account's Owner,
-- Admin and Marketing, CRO Admin/Advisor, and a granted partner (the same
-- rule as contacts_update and list_members_delete).
create or replace function can_work_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin', 'msp_marketing'))
      or auth_has_any_role('cro_admin', 'cro_advisor')
      or is_partner_for(p_account_id);
$$;

-- Tag the bad number(s); when no good number is left, move the contact to
-- the Scrub List. Returns true when the contact was scrubbed.
create or replace function mark_bad_number(p_contact_id uuid, p_which text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact contacts%rowtype;
  v_company companies%rowtype;
  v_good boolean;
  v_scrub uuid;
  v_from uuid[];
begin
  if p_which not in ('direct', 'company', 'both') then
    raise exception 'Choose Direct, Company or Both.' using errcode = '22023';
  end if;
  select * into v_contact from contacts where id = p_contact_id and archived_at is null;
  if not found or not can_work_account(v_contact.account_id) then
    raise exception 'You can''t change this contact.' using errcode = '42501';
  end if;

  if p_which in ('direct', 'both') and coalesce(trim(v_contact.phone), '') <> '' then
    update contacts set phone_bad_at = now() where id = v_contact.id;
    v_contact.phone_bad_at := now();
  end if;
  if v_contact.company_id is not null then
    select * into v_company from companies where id = v_contact.company_id;
    if p_which in ('company', 'both') and coalesce(trim(v_company.phone), '') <> '' then
      update companies set phone_bad_at = now() where id = v_company.id;
      v_company.phone_bad_at := now();
    end if;
  end if;

  v_good := (coalesce(trim(v_contact.phone), '') <> '' and v_contact.phone_bad_at is null)
         or (coalesce(trim(v_company.phone), '') <> '' and v_company.phone_bad_at is null);
  if v_good then
    return false;
  end if;

  select id into v_scrub from lists where account_id = v_contact.account_id and is_scrub and archived_at is null;
  if v_scrub is null then
    insert into lists (account_id, name, created_by, is_scrub)
    values (v_contact.account_id, 'Scrub List', auth.uid(), true)
    returning id into v_scrub;
  end if;

  select coalesce(array_agg(lm.list_id), '{}') into v_from
  from list_members lm join lists l on l.id = lm.list_id
  where lm.contact_id = v_contact.id and l.account_id = v_contact.account_id and lm.list_id <> v_scrub;

  delete from list_members where contact_id = v_contact.id and list_id = any(v_from);
  insert into list_members (list_id, contact_id, added_by) values (v_scrub, v_contact.id, auth.uid())
  on conflict (list_id, contact_id) do nothing;

  insert into scrub_entries (account_id, contact_id, which, from_list_ids, scrubbed_by)
  values (v_contact.account_id, v_contact.id, p_which, v_from, auth.uid());
  return true;
end;
$$;

-- Finish a scrubbed contact: send it back to the lists it came from (needs a
-- good number), or mark it unverified. Either way it leaves the Scrub List.
create or replace function resolve_scrub(p_contact_id uuid, p_send_back boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact contacts%rowtype;
  v_entry scrub_entries%rowtype;
  v_scrub uuid;
  v_good boolean;
begin
  select * into v_contact from contacts where id = p_contact_id and archived_at is null;
  if not found or not can_work_account(v_contact.account_id) then
    raise exception 'You can''t change this contact.' using errcode = '42501';
  end if;
  select id into v_scrub from lists where account_id = v_contact.account_id and is_scrub and archived_at is null;
  select * into v_entry from scrub_entries
    where contact_id = v_contact.id and resolved_at is null order by scrubbed_at desc limit 1;

  if p_send_back then
    select (coalesce(trim(v_contact.phone), '') <> '' and v_contact.phone_bad_at is null)
        or exists (select 1 from companies co where co.id = v_contact.company_id
                   and coalesce(trim(co.phone), '') <> '' and co.phone_bad_at is null)
      into v_good;
    if not v_good then
      raise exception 'Add a working phone number before sending this contact back.' using errcode = '23514';
    end if;
    if v_entry.id is not null then
      insert into list_members (list_id, contact_id, added_by)
      select l.id, v_contact.id, auth.uid()
      from lists l where l.id = any(v_entry.from_list_ids) and l.archived_at is null
      on conflict (list_id, contact_id) do nothing;
    end if;
  else
    insert into activities (account_id, contact_id, user_id, type, subject, body)
    values (v_contact.account_id, v_contact.id, auth.uid(), 'note', 'Scrub · couldn''t verify contact info',
            'Taken off the Scrub List without a working number.');
  end if;

  if v_scrub is not null then
    delete from list_members where list_id = v_scrub and contact_id = v_contact.id;
  end if;
  if v_entry.id is not null then
    update scrub_entries
    set resolution = case when p_send_back then 'sent_back' else 'unverified' end,
        resolved_by = auth.uid(), resolved_at = now()
    where id = v_entry.id;
  end if;
end;
$$;

grant execute on function can_work_account(uuid) to authenticated;
grant execute on function mark_bad_number(uuid, text) to authenticated;
grant execute on function resolve_scrub(uuid, boolean) to authenticated;

-- ---- The call queue knows about bad numbers and the Scrub List ----------
drop function if exists sdr_call_queue(uuid, uuid);
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
  follow_up_on date,
  phone_bad boolean,
  company_phone_bad boolean,
  on_scrub boolean,
  email text,
  company_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select lm.contact_id, array_agg(distinct l.name order by l.name) as lists, bool_or(l.is_scrub) as on_scrub
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
    last.call_outcome, last.occurred_at, last.follow_up_on,
    c.phone_bad_at is not null, co.phone_bad_at is not null,
    m.on_scrub,
    c.email, c.company_id
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

-- ---- Assign list offers the account's own Owner and Admin too -----------
-- ("any salesperson", 2026-11-02), as well as Marketing, partners and
-- roster logins as before.
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
      (u.account_id = p_account_id and u.role in ('msp_owner', 'msp_admin', 'msp_marketing'))
      or (u.role = 'partner' and exists (
        select 1 from partner_account_grants g where g.partner_user_id = u.id and g.account_id = p_account_id
      ))
      or exists (
        select 1 from account_team_members m
        where m.account_id = p_account_id and m.user_id = u.id and m.archived_at is null
      )
      or exists (
        select 1 from sdr_list_assignments a
        where a.sdr_user_id = u.id and a.account_id = p_account_id and a.archived_at is null
      )
    )
  order by u.full_name;
$$;

grant execute on function sdr_candidates(uuid) to authenticated;
