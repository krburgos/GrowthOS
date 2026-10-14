-- Client-confirmed (2026-10-14, approved mockups "CRM Pages Refresh" and
-- "Contact Detail Refresh"). Backend Schema §5.5 and §5.2 amendments.
--
-- 1. Days in stage. An opportunity records when it entered its current
--    stage, reset by a trigger whenever stage_id changes. Past stage dates
--    were never kept, so every existing opportunity starts counting from
--    the day this shipped (client-confirmed).
--
-- 2. Notes "last edited by". A contact records who last changed its notes
--    and when, stamped by a trigger whenever the notes text changes, so the
--    Notes panel at the top of Contact Detail can say so honestly.
--
-- Both are additive. Nothing reads them until the release that ships with
-- this migration.

alter table opportunities
  add column stage_entered_at timestamptz not null default now();

create or replace function stamp_opportunity_stage_entered()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_opportunities_stage_entered
  before insert or update of stage_id on opportunities
  for each row execute function stamp_opportunity_stage_entered();

alter table contacts
  add column notes_updated_at timestamptz,
  add column notes_updated_by uuid references users(id) on delete set null;

create or replace function stamp_contact_notes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.notes is not null and length(trim(new.notes)) > 0)
     or (tg_op = 'UPDATE' and new.notes is distinct from old.notes) then
    new.notes_updated_at := now();
    -- Null for the service role or a user with no users row; the time still records.
    new.notes_updated_by := (select id from users where id = auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_contacts_notes_stamp
  before insert or update of notes on contacts
  for each row execute function stamp_contact_notes();
