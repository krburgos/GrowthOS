-- Contacts filters (client-confirmed, 2026-10-22, approved mockup "Contacts
-- Filters"): "Employee Size is from ___ to ___" and the Prospect Value range
-- (which is $2,400 × employees) must cover every contact, not just the
-- loaded page, so they filter in the database. companies.company_size is
-- free text, so this adds its whole-number reading alongside it, kept in
-- step automatically. Anything that isn't a plain number reads as null,
-- the same as lib/companies/value.ts treating it as no size.
--
-- A generated column on an existing table needs no new grants.

alter table companies
  add column employee_count integer generated always as (
    case when company_size ~ '^\s*\d{1,9}\s*$' then trim(company_size)::integer end
  ) stored;

create index companies_employee_count_idx on companies(account_id, employee_count);
