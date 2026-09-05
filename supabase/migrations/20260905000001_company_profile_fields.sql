-- Client-confirmed gap-fill: App Flow §4.9's Settings screens (I1-I4)
-- never included a Company Profile screen, even though Backend Schema
-- §2's permission matrix already grants Owner/Admin edit rights on
-- "Accounts (own account settings)". Adds the fields that screen needs.
-- logo_url is a link to an already-hosted image, not a file upload —
-- Backend Schema §12 explicitly keeps file attachments out of Phase 1
-- scope, so no storage bucket is introduced here.
alter table accounts
  add column logo_url text,
  add column address_city text,
  add column address_state text;
