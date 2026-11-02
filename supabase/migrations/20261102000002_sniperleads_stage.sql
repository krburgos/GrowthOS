-- Client-confirmed (2026-11-02): a "SniperLeads" stage (open, 3%) right
-- after "Email Interest", and every SniperLead opportunity still sitting in
-- Email Interest moves there. Data only, on the accounts that already have
-- Email Interest (the SniperLeads clients). Opportunities that have moved
-- past Email Interest stay where they are.
--
-- Run as one script in the SQL Editor.

begin;

-- 1. Make room after Email Interest.
update opportunity_stages s set sort_order = s.sort_order + 1
from opportunity_stages ei
where ei.account_id = s.account_id and lower(ei.name) = 'email interest' and ei.archived_at is null
  and s.archived_at is null and s.sort_order > ei.sort_order
  and not exists (select 1 from opportunity_stages x where x.account_id = s.account_id and lower(x.name) = 'sniperleads' and x.archived_at is null);

-- 2. The SniperLeads stage.
insert into opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default)
select ei.account_id, 'SniperLeads', 'open', ei.sort_order + 1, 3, false
from opportunity_stages ei
where lower(ei.name) = 'email interest' and ei.archived_at is null
  and not exists (select 1 from opportunity_stages x where x.account_id = ei.account_id and lower(x.name) = 'sniperleads' and x.archived_at is null);

-- 3. SniperLead opportunities in Email Interest move to SniperLeads.
update opportunities o set stage_id = sl.id
from opportunity_stages ei, opportunity_stages sl
where o.stage_id = ei.id and lower(ei.name) = 'email interest'
  and sl.account_id = ei.account_id and lower(sl.name) = 'sniperleads' and sl.archived_at is null
  and o.type = 'SniperLead' and o.archived_at is null;

commit;
