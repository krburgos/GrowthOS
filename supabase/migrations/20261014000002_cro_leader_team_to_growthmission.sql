-- Client-confirmed (2026-10-14): the "CRO Leader Team" outsourced roster
-- member was how GrowthMission work was recorded before orders had a
-- type. Its orders become GrowthMission orders and the member is archived
-- (never deleted). Backend Schema §6.6f amendment.
--
-- Apply with the release that reads growth_mission_tasks.delegated. Before
-- that release, the old screens would show these orders as unassigned.
--
-- Side effects, confirmed with the client: its completed orders now count
-- as credits used, and its weekly hours leave Hours available. It had no
-- discipline assignments. Run as the service role, so the
-- guard_growthmission_orders() completion rule does not apply.

update growth_mission_tasks t
set delegated = true, assignee_id = null
from account_team_members m
where t.assignee_id = m.id
  and m.kind = 'outsourced'
  and m.name = 'CRO Leader Team'
  and m.archived_at is null;

update account_team_members
set archived_at = now()
where kind = 'outsourced'
  and name = 'CRO Leader Team'
  and archived_at is null;
