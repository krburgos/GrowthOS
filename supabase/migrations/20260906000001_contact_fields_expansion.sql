-- Client-confirmed deviation from Backend Schema §5.3: full_name splits
-- into first_name/last_name (CSV imports usually carry these as
-- separate columns). full_name is kept as a generated column so every
-- existing read path (sort, search, display) keeps working unchanged —
-- only the write paths (Add Contact, Contact Detail edit, import)
-- change to set first/last name instead.
--
-- Also adds Score (manual number), Temp (Hot/Cold), and a contact-level
-- LinkedIn link — all new concepts, not previously in the PRD/Backend
-- Schema — plus Company Phone and Company Address 1 on companies.

alter table contacts add column first_name text;
alter table contacts add column last_name text;

update contacts set
  first_name = split_part(full_name, ' ', 1),
  last_name = nullif(btrim(substring(full_name from position(' ' in full_name) + 1)), '')
where position(' ' in full_name) > 0;

update contacts set first_name = full_name
where position(' ' in full_name) = 0;

alter table contacts alter column first_name set not null;

alter table contacts drop column full_name;
alter table contacts add column full_name text
  generated always as (btrim(first_name || coalesce(' ' || nullif(last_name, ''), ''))) stored;

create type contact_temperature as enum ('hot', 'cold');

alter table contacts
  add column score integer,
  add column temperature contact_temperature,
  add column linkedin_url text;

alter table companies
  add column phone text,
  add column address_line1 text;
