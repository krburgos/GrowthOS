-- Bounces on the contact (client-confirmed, 2026-10-22). Until now a bounce
-- was only recorded on the campaign send that bounced
-- (campaign_recipients.bounced_at), so the Contacts table's Bounced column
-- had nothing to read and 1-1 emails from Contact Detail, which carry no
-- campaign token, lost their bounces entirely.
--
-- contacts.email_bounced_at is set by the Resend webhook
-- (app/api/webhooks/resend) for a bounce from either kind of send, and
-- cleared automatically when the contact's email address is changed, since
-- the new address hasn't bounced. Existing campaign bounces are copied
-- across once.
--
-- A new column on an existing table needs no new grants; contacts' RLS
-- policies already cover it.

alter table contacts add column email_bounced_at timestamptz;

update contacts c
set email_bounced_at = b.bounced_at
from (
  select contact_id, max(bounced_at) as bounced_at
  from campaign_recipients
  where bounced_at is not null
  group by contact_id
) b
where b.contact_id = c.id;

create index contacts_email_bounced_idx on contacts(account_id) where email_bounced_at is not null;

create or replace function clear_bounce_on_email_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    new.email_bounced_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_contacts_clear_bounce
  before update of email on contacts
  for each row execute function clear_bounce_on_email_change();
