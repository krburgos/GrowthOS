-- Client-confirmed (2026-11-10): in CRO Leader's own MSP account, CRO
-- Leader staff are its in-house team, so a CRO Admin or CRO Advisor login
-- may be connected to a Sales & Marketing (in_house) roster row there.
--
-- Every other account keeps the 2026-10-27 rule unchanged: in_house takes
-- only that account's own active users; outsourced takes an active CRO Admin
-- or CRO Advisor, or a Partner granted the account. CRO Leader's account is
-- named by id, since its name can be edited.

create or replace function roster_login_allowed(p_account_id uuid, p_kind account_team_kind, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from users u
    where u.id = p_user_id and u.archived_at is null and u.removed_at is null
      and (
        (p_kind = 'in_house' and (
          u.account_id = p_account_id
          -- CRO Leader's own account (2026-11-10).
          or (p_account_id = 'e188beea-e349-4ad6-9a24-6fda7220488a'::uuid and u.role in ('cro_admin', 'cro_advisor'))
        ))
        or (p_kind = 'outsourced' and (
          u.role in ('cro_admin', 'cro_advisor')
          or (u.role = 'partner' and exists (
            select 1 from partner_account_grants g where g.partner_user_id = u.id and g.account_id = p_account_id))
        ))
      )
  );
$function$;
