-- Client-confirmed (2026-10-18, approved mockup "Import Repeated Emails"):
-- contact imports run in batches and let the user overwrite or keep a
-- contact whose email is already in the account.
--
-- Each batch has to find which of its emails already belong to a contact,
-- matched the way contacts_account_email_unique matches them, ignoring
-- case. PostgREST's .in() compares exactly, so a contact stored as
-- "Jordan@x.com" would be missed for "jordan@x.com" and the insert would
-- then hit the unique index. The import also used to read every contact
-- in the account, which stops at PostgREST's 1,000-row page.
--
-- Security invoker: RLS still decides which contacts the caller sees.

create or replace function find_contacts_by_email(p_account_id uuid, p_emails text[])
returns table (id uuid, email_key text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, lower(c.email)
  from contacts c
  where c.account_id = p_account_id
    and c.archived_at is null
    and lower(c.email) = any (select lower(trim(e)) from unnest(p_emails) as e);
$$;

grant execute on function find_contacts_by_email(uuid, text[]) to authenticated;
