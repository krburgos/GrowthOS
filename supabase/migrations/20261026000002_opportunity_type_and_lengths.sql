-- Client-confirmed (2026-10-26, approved mockup "Opportunity Type"):
-- * opportunities.type: optional free text ("Managed IT", "Cybersecurity"),
--   no fixed list; the app suggests types already used in the account.
-- * Name and type are at most 60 characters (same day), so a list column
--   never has to hold an absurdly long value. No existing name was longer
--   than 30 when this ran.

alter table opportunities add column type text;

alter table opportunities add constraint opportunities_type_length
  check (type is null or (btrim(type) <> '' and char_length(type) <= 60));

alter table opportunities add constraint opportunities_name_length
  check (char_length(name) <= 60);
