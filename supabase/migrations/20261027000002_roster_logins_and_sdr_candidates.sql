-- Client-confirmed (2026-10-27, approved mockup "SDR Login and Dialing"):
-- a Company Profile roster person can be connected to their GrowthMission
-- login, and a connected person can be given SDR lists for that client.
-- This widens the 2026-10-22 rule (in-house SDR = MSP Marketing user,
-- outsourced SDR = Partner) so CRO Leader staff on a client's Outsourced
-- roster - John Garcia on Team Logic IT - New York was the case - can work
-- its Call Queue.
--
-- account_team_members.user_id already existed (My Visits reads it) but
-- nothing wrote it. Who may be connected:
--   in_house   - an active user of the account itself
--   outsourced - an active CRO Admin or CRO Advisor, or a Partner granted
--                the account. CRO Service Team is left out because it
--                cannot log calls (activities_insert), so it could hold a
--                queue it could never work.
-- One roster row per login per account.

create unique index account_team_members_one_row_per_login
  on account_team_members(account_id, user_id)
  where user_id is not null and archived_at is null;

-- The rule itself, shared by the picker and the guard. No caller check:
-- the guard runs it for whoever is writing, and the RLS on
-- account_team_members already decides who may write.
create or replace function roster_login_allowed(p_account_id uuid, p_kind account_team_kind, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users u
    where u.id = p_user_id
      and u.archived_at is null
      and u.removed_at is null
      and (
        (p_kind = 'in_house' and u.account_id = p_account_id)
        or (p_kind = 'outsourced' and (
          u.role in ('cro_admin', 'cro_advisor')
          or (u.role = 'partner' and exists (
            select 1 from partner_account_grants g where g.partner_user_id = u.id and g.account_id = p_account_id
          ))
        ))
      )
  );
$$;

-- Supabase grants execute to anon/authenticated explicitly, so revoking
-- from public alone is not enough.
revoke execute on function roster_login_allowed(uuid, account_team_kind, uuid) from public, anon, authenticated;

-- The Edit person picker. Security definer because MSP users cannot read
-- CRO Leader or partner rows in `users`; the caller must be able to see
-- the account itself.
create or replace function roster_login_candidates(p_account_id uuid)
returns table (id uuid, full_name text, role user_role, kind account_team_kind)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.full_name, u.role, k.kind
  from users u
  cross join (values ('in_house'::account_team_kind), ('outsourced'::account_team_kind)) k(kind)
  where (p_account_id = auth_account_id() or is_cro_leader() or is_partner_for(p_account_id))
    and roster_login_allowed(p_account_id, k.kind, u.id)
  order by k.kind, u.full_name;
$$;

grant execute on function roster_login_candidates(uuid) to authenticated;

-- Security definer so it can call roster_login_allowed, which is not
-- granted to authenticated.
create or replace function guard_account_team_member_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id or new.kind is distinct from old.kind)
     and not roster_login_allowed(new.account_id, new.kind, new.user_id) then
    raise exception 'That login cannot be connected to this roster.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_account_team_member_login
  before insert or update on account_team_members
  for each row execute function guard_account_team_member_login();

-- SDR list: as before, plus anyone the account's roster connects to a login.
create or replace function sdr_candidates(p_account_id uuid)
returns table (id uuid, full_name text, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.full_name, u.role
  from users u
  where (p_account_id = auth_account_id() or is_cro_leader() or is_partner_for(p_account_id))
    and u.archived_at is null
    and (
      (u.account_id = p_account_id and u.role = 'msp_marketing')
      or (u.role = 'partner' and exists (
        select 1 from partner_account_grants g where g.partner_user_id = u.id and g.account_id = p_account_id
      ))
      or exists (
        select 1 from account_team_members m
        where m.account_id = p_account_id and m.user_id = u.id and m.archived_at is null
      )
      or exists (
        select 1 from sdr_list_assignments a
        where a.sdr_user_id = u.id and a.account_id = p_account_id and a.archived_at is null
      )
    )
  order by u.full_name;
$$;
