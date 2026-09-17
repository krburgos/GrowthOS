-- Company Profile expansion (client-confirmed, 2026-09-17): the profile now
-- carries a full mailing address, a phone number, the CEO's name, and one
-- combined Sales & Marketing team of typed names shown on the Dashboard.
-- The team is a text[] on accounts rather than its own table: these are
-- plain labels, not records with their own identity or permissions, so
-- editing the list is a field edit (no soft-delete semantics needed), the
-- same reasoning behind the jsonb answer blobs on the questionnaire and
-- Vision Board tables. Existing accounts_* RLS covers the new columns —
-- Owner/Admin (own account) and CRO Admin/Advisor (any) write, everyone
-- else in the account reads.

alter table accounts
  add column address_street text,
  add column address_suite text,
  add column address_zip text,
  add column phone text,
  add column ceo_name text,
  add column sales_marketing_names text[] not null default '{}'::text[];
