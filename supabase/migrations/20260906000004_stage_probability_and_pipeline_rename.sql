-- Client-confirmed pipeline content update (2026-09-06):
-- 1. Contact Statuses' seeded defaults change from the original 14
--    (Backend Schema §7.5 / Developer Brief §16.2) to a new 8-item list.
-- 2. Opportunity Stages' seeded defaults change from the original 13 to
--    a new 14-item list, and every stage now carries an editable
--    win_probability (0-100) the client can tune per stage — previously
--    there was no probability concept anywhere in the schema.
-- Existing accounts still sitting on the original default names are
-- renamed in place (preserving row id, so any contact/opportunity
-- already pointing at that row keeps pointing at it, just under the
-- new name). An account that already customized a status/stage away
-- from the original default name is left untouched by these renames.

alter table opportunity_stages add column win_probability smallint not null default 0;

-- Rename stages still on their original seeded name; carries forward
-- sort_order, stage_group (only where the client's answers changed it),
-- and sets the new win_probability. "Ghosted" and "Won"/"Lost" keep
-- their name but still need stage_group/probability updates.
update opportunity_stages set name = 'Showing Interest', sort_order = 1, win_probability = 5 where name = 'Identified Interest';
update opportunity_stages set name = 'FME Scheduled', sort_order = 2, win_probability = 10 where name = 'Discovery Scheduled';
update opportunity_stages set name = 'FME Attended Opportunity Identified', sort_order = 3, win_probability = 30 where name = 'Discovery Completed';
update opportunity_stages set name = '2nd Meeting Scheduled', sort_order = 4, win_probability = 35 where name = 'Solution Alignment';
update opportunity_stages set name = 'Quote/Solution Prepared', sort_order = 6, win_probability = 45 where name = 'Proposal Development';
update opportunity_stages set name = 'Proposal Emailed', sort_order = 7, win_probability = 55 where name = 'Proposal Delivered';
update opportunity_stages set name = 'Proposal Presented', sort_order = 8, win_probability = 80 where name = 'Negotiation';
update opportunity_stages set name = 'Verbal', sort_order = 10, win_probability = 90 where name = 'Verbal Commitment';
update opportunity_stages set name = 'Pondering Decision', sort_order = 9, win_probability = 50 where name = 'Contract Sent';
update opportunity_stages set name = 'Won', stage_group = 'won', sort_order = 12, win_probability = 100 where name = 'Closed Won';
update opportunity_stages set name = 'Lost', stage_group = 'lost', sort_order = 13, win_probability = 0 where name = 'Closed Lost';
-- Client direction: Ghosted keeps a live win probability, so it moves
-- from the Lost group into Open (no longer auto-closes on assignment).
update opportunity_stages set stage_group = 'open', sort_order = 11, win_probability = 25 where name = 'Ghosted';
-- Client direction: Lost Resurrected stays in the Lost group (unlike
-- Ghosted) despite carrying a nonzero probability.
update opportunity_stages set name = 'Lost Resurrected', stage_group = 'lost', sort_order = 14, win_probability = 25 where name = 'On Hold';

-- "2nd Meeting Conducted" has no prior-default equivalent to rename, so
-- add it fresh for every account that just had its "Pondering Decision"
-- (formerly "Contract Sent") row renamed above.
insert into opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default)
select account_id, '2nd Meeting Conducted', 'open', 5, 40, true
from opportunity_stages
where name = 'Pondering Decision';

alter table opportunity_stages add constraint opportunity_stages_win_probability_range check (win_probability between 0 and 100);

create or replace function seed_default_opportunity_stages(p_account_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default) values
    (p_account_id, 'Showing Interest', 'open', 1, 5, true),
    (p_account_id, 'FME Scheduled', 'open', 2, 10, true),
    (p_account_id, 'FME Attended Opportunity Identified', 'open', 3, 30, true),
    (p_account_id, '2nd Meeting Scheduled', 'open', 4, 35, true),
    (p_account_id, '2nd Meeting Conducted', 'open', 5, 40, true),
    (p_account_id, 'Quote/Solution Prepared', 'open', 6, 45, true),
    (p_account_id, 'Proposal Emailed', 'open', 7, 55, true),
    (p_account_id, 'Proposal Presented', 'open', 8, 80, true),
    (p_account_id, 'Pondering Decision', 'open', 9, 50, true),
    (p_account_id, 'Verbal', 'open', 10, 90, true),
    (p_account_id, 'Ghosted', 'open', 11, 25, true),
    (p_account_id, 'Won', 'won', 12, 100, true),
    (p_account_id, 'Lost', 'lost', 13, 0, true),
    (p_account_id, 'Lost Resurrected', 'lost', 14, 25, true);
end;
$$;

create or replace function seed_default_contact_statuses()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  defaults text[] := array[
    'MQC', 'MQL', 'Scrub', 'Existing Client', 'Engaged', 'Not a Fit', 'Internal', 'UnSub - Call Only'
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
$$;

-- Scoped fix for the one real working account (CRO Leader) that had
-- already been manually customized toward this new list ahead of this
-- migration — rename in place where a 1:1 match exists (keeps contacts
-- already on that status pointed at the same row), add the three names
-- with no prior equivalent, and leave the "SNIPER" status the client
-- asked to keep as an extra, moving it to the end of the list.
update contact_statuses set name = 'UnSub - Call Only', sort_order = 7 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'Unsub Call Often';
update contact_statuses set sort_order = 0 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'MQC';
update contact_statuses set sort_order = 1 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'MQL';
update contact_statuses set sort_order = 2 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'Scrub';
update contact_statuses set sort_order = 4 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'Engaged';
update contact_statuses set sort_order = 8 where account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a' and name = 'SNIPER';

insert into contact_statuses (account_id, name, sort_order, is_default) values
  ('e188beea-e349-4ad6-9a24-6fda7220488a', 'Existing Client', 3, true),
  ('e188beea-e349-4ad6-9a24-6fda7220488a', 'Not a Fit', 5, true),
  ('e188beea-e349-4ad6-9a24-6fda7220488a', 'Internal', 6, true);
