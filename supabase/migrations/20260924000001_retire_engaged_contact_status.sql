-- Client-confirmed (2026-09-24): "Engaged" is retired as a contact status.
-- It came from the seeded defaults, existed in all 17 accounts, and fed the
-- KPI Dashboard's Engaged box, which is removed in the same change.
--
-- Contacts on it move to that account's MQC first, at the client's
-- direction, so nobody is left status-less. Verified beforehand that every
-- account carrying Engaged also carries MQC.

-- 1. Move every contact (archived ones too, so their record stays valid).
update contacts c
set status_id = m.id
from contact_statuses e
join contact_statuses m
  on m.account_id = e.account_id and lower(m.name) = 'mqc' and m.archived_at is null
where c.status_id = e.id
  and lower(e.name) = 'engaged'
  and e.archived_at is null;

-- 2. Archive rather than delete — soft delete everywhere (Backend Schema §5).
--    Any history that pointed at this status stays resolvable.
update contact_statuses
set archived_at = now()
where lower(name) = 'engaged' and archived_at is null;

-- 3. New accounts stop being seeded with it.
create or replace function public.seed_default_contact_statuses()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  defaults text[] := array[
    'MQC', 'MQL', 'Scrub', 'Existing Client', 'Not a Fit', 'Internal', 'UnSub - Call Only'
  ];
  status_name text;
  i integer := 0;
begin
  foreach status_name in array defaults loop
    insert into public.contact_statuses (account_id, name, sort_order, is_default)
    values (new.id, status_name, i, true);
    i := i + 1;
  end loop;
  return new;
end;
$function$;
