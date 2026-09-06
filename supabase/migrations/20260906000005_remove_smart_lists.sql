-- Client-confirmed removal (2026-09-06): the client does not want Smart
-- Lists at all — "My customers want to manually add contacts to a
-- list." This is a deliberate deviation from PRD §6.3 ("Lists support
-- manual add/remove AND criteria-based (saved-filter) population") and
-- everywhere else smart lists were subsequently built out (App Flow
-- §4.6 F1/F2/F3, Backend Schema §5.4/§7.4, the smart_list_manual_overrides
-- migration, Implementation Plan Milestone 7) — flagged to the client
-- as a spec contradiction before proceeding; they confirmed removal
-- anyway. Every list becomes what a "static" list already was: a plain,
-- manually-curated set of contacts via list_members. No replacement
-- concept — this is a pure removal, not a rename.

-- The one existing smart list is a Milestone 7 QA fixture (0 manual
-- members, 0 exclusions, not real customer data) — archived (soft
-- delete, same rule as every other entity) rather than converted,
-- since there's nothing worth preserving in it.
update lists set archived_at = now() where type = 'smart';

drop function if exists compute_smart_list_members(uuid);
drop table if exists list_exclusions;

alter table lists drop constraint if exists lists_criteria_only_for_smart;
alter table lists drop column if exists criteria;
alter table lists drop column if exists type;
drop type if exists list_type;
