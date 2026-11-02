-- Client-confirmed (2026-11-02, approved mockup "No Number Scrub"): a
-- contact with no phone number at all (neither its own nor its company's)
-- can be logged as Bad number with "No number", which sends it to the Scrub
-- List so someone can find one. Nothing is tagged, since there is no number.
-- "No number" is refused while the contact still has a number.
--
-- Run as one script in the SQL Editor before deploying the code that sends it.

alter table scrub_entries drop constraint if exists scrub_entries_which_check;
alter table scrub_entries add constraint scrub_entries_which_check check (which in ('direct', 'company', 'both', 'none'));

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
  if p_which not in ('direct', 'company', 'both', 'none') then
    raise exception 'Choose Direct, Company, Both or No number.' using errcode = '22023';
  end if;
  select * into v_contact from contacts where id = p_contact_id and archived_at is null;
  if not found or not can_work_account(v_contact.account_id) then
    raise exception 'You can''t change this contact.' using errcode = '42501';
  end if;
  if v_contact.company_id is not null then
    select * into v_company from companies where id = v_contact.company_id;
  end if;

  if p_which = 'none' and (coalesce(trim(v_contact.phone), '') <> '' or coalesce(trim(v_company.phone), '') <> '') then
    raise exception 'This contact has a phone number. Choose which one was bad.' using errcode = '22023';
  end if;

  if p_which in ('direct', 'both') and coalesce(trim(v_contact.phone), '') <> '' then
    update contacts set phone_bad_at = now() where id = v_contact.id;
    v_contact.phone_bad_at := now();
  end if;
  if p_which in ('company', 'both') and coalesce(trim(v_company.phone), '') <> '' then
    update companies set phone_bad_at = now() where id = v_company.id;
    v_company.phone_bad_at := now();
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

grant execute on function mark_bad_number(uuid, text) to authenticated;
