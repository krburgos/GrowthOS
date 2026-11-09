-- SniperLeads Reports showed 0 for some clients (2026-11-09).
--
-- sniperleads_numbers() is security invoker (Backend Schema §6.6o), so RLS
-- runs on every contact, list and opportunity row it counts. These SELECT
-- policies called auth_account_id() / is_cro_leader() once per row: about
-- 0.85 s per client with ~2,000 list members. The /cro page counts all 11
-- clients at once, and on 2026-11-09 three of them hit the 8 s statement
-- timeout for `authenticated` (postgres logs, 15:24 UTC) and showed 0.
--
-- Wrapping the helpers in a scalar sub-select makes Postgres run them once
-- per query (same change as 20261108000001 §4). The conditions are word for
-- word the same, so nobody sees more or less than before. Measured as a CRO
-- Admin on Iron Wolf Technology: 845 ms -> 55 ms.
--
-- is_partner_for(account_id) takes the row's account, so it can't be hoisted;
-- it is only reached when the first two conditions are false.

alter policy contacts_select on public.contacts
  using ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id));

alter policy contact_statuses_select on public.contact_statuses
  using ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id));

alter policy lists_select on public.lists
  using ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id));

alter policy list_members_select on public.list_members
  using (exists (
    select 1 from public.lists l
    where l.id = list_members.list_id
      and ((l.account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(l.account_id))
  ));

alter policy opportunities_select on public.opportunities
  using ((archived_at is null)
    and ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id)));

alter policy opportunity_stages_select on public.opportunity_stages
  using ((account_id = (select auth_account_id())) or (select is_cro_leader()) or is_partner_for(account_id));
