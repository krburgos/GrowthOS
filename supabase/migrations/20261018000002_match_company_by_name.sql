-- Client-confirmed (2026-10-18): match_or_create_company() also matches an
-- existing company by name, so a contact imported or added with a company
-- name but no website links to that company instead of creating a second
-- one every time. Until now it matched on domain only (Backend Schema §7.3),
-- which made ten rows for "Acme" with no website into ten Acme companies.
--
-- Order of matching:
--   1. the domain, when one is given (unchanged);
--   2. otherwise the exact name, ignoring case and surrounding spaces, but
--      only where the two cannot disagree on domain: either no domain was
--      given, or the existing company has none (it then takes this one).
--      Two companies that share a name but have different websites stay
--      separate; Merge is still the tool for those.
--   3. otherwise a new company, as before.
--
-- Security invoker as before, so RLS still decides what the caller can see
-- and write.

create or replace function match_or_create_company(p_account_id uuid, p_name text, p_domain text default null)
returns uuid
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

  if v_domain is not null then
    select id into v_company_id from companies
      where account_id = p_account_id and domain = v_domain and archived_at is null
      limit 1;
  end if;

  v_name := nullif(lower(trim(p_name)), '');
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

  if v_company_id is null then
    insert into companies (account_id, name, domain)
    values (p_account_id, p_name, v_domain)
    returning id into v_company_id;
  end if;

  return v_company_id;
end;
$function$;
