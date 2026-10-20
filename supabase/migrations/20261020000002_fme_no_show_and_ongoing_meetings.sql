-- Client-confirmed (2026-10-20): two new opportunity stages, for every
-- account and for the defaults a new account starts with.
--   - FME No Show (open, 5%): third in the list, after the first-meeting
--     booking stage ("FME Scheduled" in the default list).
--   - Ongoing Meetings (open, 40%): straight after "2nd Meeting Conducted".
--
-- Existing accounts keep their own order and names; the new stages slot in
-- by position, shifting the later ones down. An account that already has a
-- stage by either name, or (for Ongoing Meetings) has no "2nd Meeting
-- Conducted" to follow, is left as it is. Safe to run twice.

do $$
declare
  acct record;
  after_order integer;
begin
  for acct in select id from accounts loop
    if not exists (
      select 1 from opportunity_stages
      where account_id = acct.id and archived_at is null and lower(name) = 'fme no show'
    ) then
      select sort_order into after_order
      from opportunity_stages
      where account_id = acct.id and archived_at is null
      order by sort_order, created_at
      offset 1 limit 1;

      if after_order is not null then
        update opportunity_stages set sort_order = sort_order + 1
        where account_id = acct.id and sort_order > after_order;
        insert into opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default)
        values (acct.id, 'FME No Show', 'open', after_order + 1, 5, true);
      end if;
    end if;

    if not exists (
      select 1 from opportunity_stages
      where account_id = acct.id and archived_at is null and lower(name) = 'ongoing meetings'
    ) then
      select sort_order into after_order
      from opportunity_stages
      where account_id = acct.id and archived_at is null and lower(name) = '2nd meeting conducted'
      order by sort_order
      limit 1;

      if after_order is not null then
        update opportunity_stages set sort_order = sort_order + 1
        where account_id = acct.id and sort_order > after_order;
        insert into opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default)
        values (acct.id, 'Ongoing Meetings', 'open', after_order + 1, 40, true);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.seed_default_opportunity_stages(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.opportunity_stages (account_id, name, stage_group, sort_order, win_probability, is_default) values
    (p_account_id, 'Showing Interest', 'open', 1, 5, true),
    (p_account_id, 'FME Scheduled', 'open', 2, 10, true),
    (p_account_id, 'FME No Show', 'open', 3, 5, true),
    (p_account_id, 'FME Attended Opportunity Identified', 'open', 4, 30, true),
    (p_account_id, '2nd Meeting Scheduled', 'open', 5, 35, true),
    (p_account_id, '2nd Meeting Conducted', 'open', 6, 40, true),
    (p_account_id, 'Ongoing Meetings', 'open', 7, 40, true),
    (p_account_id, 'Quote/Solution Prepared', 'open', 8, 45, true),
    (p_account_id, 'Proposal Emailed', 'open', 9, 55, true),
    (p_account_id, 'Proposal Presented', 'open', 10, 80, true),
    (p_account_id, 'Pondering Decision', 'open', 11, 50, true),
    (p_account_id, 'Verbal', 'open', 12, 90, true),
    (p_account_id, 'Ghosted', 'open', 13, 25, true),
    (p_account_id, 'Won', 'won', 14, 100, true),
    (p_account_id, 'Lost', 'lost', 15, 0, true),
    (p_account_id, 'Lost Resurrected', 'lost', 16, 25, true);
end;
$function$;
