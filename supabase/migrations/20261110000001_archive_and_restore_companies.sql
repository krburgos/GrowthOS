-- Client-confirmed (2026-11-10, approved mockups "Delete Company Mockup" and
-- "Delete Companies Table Mockup"): companies can be deleted, and a deleted
-- company comes back when a contact from it shows up again.
--
--   1. archive_companies(ids): Delete on Company Detail and on the Companies
--      table's bulk bar. Same people as deleting an opportunity: an Owner or
--      Admin on their own account, or CRO Admin. A company that still has a
--      contact or an opportunity (not deleted) is skipped, never archived,
--      so nothing disappears by surprise. Delete = archived_at, as always.
--   2. companies.merged_into_id: merge_companies() now records where a
--      company went, so a merged-away duplicate is never brought back.
--   3. match_or_create_company_detail(): the old matching (domain, then
--      exact name), then, before creating a new company, a deleted company
--      with that domain or name is restored (archived_at cleared) with its
--      history, logo and past opportunities. Returns {id, status}:
--      matched (a live company), restored or created.
--      match_or_create_company() keeps its signature and calls it, so
--      every existing caller restores too. Callers then write any values the
--      new contact or import row fills in over the old ones (blanks keep the
--      old value), which is what the import already does.
--
-- Run in the SQL Editor before (or right after) deploying the code that
-- calls it. Until then Delete shows an error and adding contacts works as
-- before.

alter table companies add column if not exists merged_into_id uuid references companies(id);

create or replace function merge_companies(
  p_source_company_id uuid,
  p_target_company_id uuid
)
returns void
language plpgsql security invoker
set search_path = public
as $$
begin
  update contacts set company_id = p_target_company_id where company_id = p_source_company_id;
  update opportunities set company_id = p_target_company_id where company_id = p_source_company_id;
  update companies set archived_at = now(), merged_into_id = p_target_company_id where id = p_source_company_id;
end;
$$;

create or replace function archive_companies(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
  v_skipped integer;
begin
  if exists (
    select 1 from companies c
    where c.id = any(p_ids) and c.archived_at is null
      and not ((c.account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
               or auth_has_any_role('cro_admin'))
  ) then
    raise exception 'Only an Owner, Admin or CRO Admin can delete a company.' using errcode = '42501';
  end if;

  select count(*) into v_skipped
  from companies c
  where c.id = any(p_ids) and c.archived_at is null
    and (exists (select 1 from contacts ct where ct.company_id = c.id and ct.archived_at is null)
         or exists (select 1 from opportunities o where o.company_id = c.id and o.archived_at is null));

  update companies c set archived_at = now()
  where c.id = any(p_ids) and c.archived_at is null
    and not exists (select 1 from contacts ct where ct.company_id = c.id and ct.archived_at is null)
    and not exists (select 1 from opportunities o where o.company_id = c.id and o.archived_at is null);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'skipped', v_skipped);
end;
$$;

create or replace function match_or_create_company_detail(p_account_id uuid, p_name text, p_domain text default null)
returns jsonb
language plpgsql
set search_path = public
as $function$
declare
  v_domain text;
  v_name text;
  v_company_id uuid;
begin
  if p_domain is not null then
    v_domain := lower(regexp_replace(trim(p_domain), '^(https?://)?(www\.)?', ''));
    v_domain := split_part(v_domain, '/', 1);
    if v_domain = '' then v_domain := null; end if;
  end if;
  v_name := nullif(lower(trim(p_name)), '');

  -- 1. A live company with this domain.
  if v_domain is not null then
    select id into v_company_id from companies
      where account_id = p_account_id and domain = v_domain and archived_at is null
      limit 1;
  end if;

  -- 2. A live company with this exact name that can't disagree on domain.
  if v_company_id is null and v_name is not null then
    select id into v_company_id from companies
      where account_id = p_account_id
        and archived_at is null
        and lower(trim(name)) = v_name
        and (v_domain is null or domain is null)
      order by created_at
      limit 1;

    if v_company_id is not null and v_domain is not null then
      update companies set domain = v_domain where id = v_company_id and domain is null;
    end if;
  end if;

  if v_company_id is not null then
    return jsonb_build_object('id', v_company_id, 'status', 'matched');
  end if;

  -- 3. A deleted company with this domain, or this name (where the domains
  --    can't disagree), most recently deleted first. Never a merged-away one.
  --    Skipped if a live company has since taken its website (one live
  --    company per domain).
  select c.id into v_company_id from companies c
    where c.account_id = p_account_id
      and c.archived_at is not null
      and c.merged_into_id is null
      and ((v_domain is not null and c.domain = v_domain)
           or (v_name is not null and lower(trim(c.name)) = v_name
               and (v_domain is null or c.domain is null or c.domain = v_domain)))
      and (c.domain is null or not exists (
            select 1 from companies l
            where l.account_id = p_account_id and l.domain = c.domain and l.archived_at is null))
    order by (v_domain is not null and c.domain = v_domain) desc, c.archived_at desc
    limit 1;

  if v_company_id is not null then
    update companies
      set archived_at = null,
          domain = coalesce(domain, v_domain)
      where id = v_company_id;
    return jsonb_build_object('id', v_company_id, 'status', 'restored');
  end if;

  -- 4. A new company.
  insert into companies (account_id, name, domain)
  values (p_account_id, p_name, v_domain)
  returning id into v_company_id;

  return jsonb_build_object('id', v_company_id, 'status', 'created');
end;
$function$;

create or replace function match_or_create_company(p_account_id uuid, p_name text, p_domain text default null)
returns uuid
language sql
set search_path = public
as $$
  select (match_or_create_company_detail(p_account_id, p_name, p_domain) ->> 'id')::uuid;
$$;

-- Signed-in callers only (2026-11-08 hardening: nothing callable by anon).
revoke execute on function archive_companies(uuid[]) from public, anon;
grant execute on function archive_companies(uuid[]) to authenticated, service_role;
revoke execute on function match_or_create_company_detail(uuid, text, text) from public, anon;
grant execute on function match_or_create_company_detail(uuid, text, text) to authenticated, service_role;
revoke execute on function match_or_create_company(uuid, text, text) from public, anon;
grant execute on function match_or_create_company(uuid, text, text) to authenticated, service_role;
revoke execute on function merge_companies(uuid, uuid) from public, anon;
grant execute on function merge_companies(uuid, uuid) to authenticated, service_role;
