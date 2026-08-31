-- Deviation from Backend Schema §5.3: companies.geography (single free-text
-- field, matching PRD §6.1's "geography") is replaced with structured
-- city/state columns. App Flow §4.4 (D1 Contacts List) requires separate
-- sortable "Company City" and "Company State" columns, which a single
-- free-text field can't support. Confirmed with the client — literal
-- App Flow columns win over the single-field PRD/Backend Schema wording.

alter table companies drop column if exists geography;
alter table companies add column city text;
alter table companies add column state text;
