-- Client-confirmed (2026-10-27, approved mockup "CRO GrowthMission Orders"):
-- the CRO Leader Dashboard lists every GrowthMission order across clients,
-- and CRO Leader assigns each one to a member of its own team. Backend
-- Schema §6.6f amendment.
--
-- cro_owner_id is who on the CRO Leader team works a delegated order. It is
-- separate from assignee_id, which points at the client's roster and stays
-- null on a delegated order. Clients don't see it.
--
-- Only an addition. RLS is unchanged: CRO Admin/Advisor already update any
-- order and Service Team reads only.

alter table growth_mission_tasks
  add column cro_owner_id uuid references users(id) on delete set null,
  add constraint growth_mission_tasks_cro_owner_delegated check (cro_owner_id is null or delegated);

create index growth_mission_tasks_cro_owner_idx on growth_mission_tasks (cro_owner_id) where cro_owner_id is not null;

-- The completion rule from 20261014000001, unchanged, plus three lines for
-- the CRO owner: it clears when an order is taken back from GrowthMission,
-- it must be an active CRO Leader team member, and only CRO Admin/Advisor
-- may set or change it.
create or replace function guard_growthmission_orders()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.delegated then
    new.assignee_id := null;
  else
    new.cro_owner_id := null;
  end if;

  if new.cro_owner_id is not null
     and (tg_op = 'INSERT' or new.cro_owner_id is distinct from old.cro_owner_id)
     and not exists (
       select 1 from users
       where id = new.cro_owner_id
         and role in ('cro_admin', 'cro_advisor', 'cro_service_team')
         and archived_at is null
         and removed_at is null
     ) then
    raise exception 'A GrowthMission order can only be owned by an active CRO Leader team member.' using errcode = '23514';
  end if;

  -- CRO Admin/Advisor, and the service role (no auth.uid), are unrestricted.
  if auth.uid() is null or auth_has_any_role('cro_admin', 'cro_advisor') then
    return new;
  end if;

  if new.cro_owner_id is not null
     and (tg_op = 'INSERT' or new.cro_owner_id is distinct from old.cro_owner_id) then
    raise exception 'Only CRO Leader can choose who on its team owns a GrowthMission order.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.delegated and new.state = 'complete' then
      raise exception 'Only CRO Leader can confirm a GrowthMission order complete.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- A completed GrowthMission order has spent its credits.
  if old.delegated and old.state = 'complete' then
    if new.state is distinct from old.state
       or new.hours is distinct from old.hours
       or new.delegated is distinct from old.delegated
       or new.archived_at is distinct from old.archived_at then
      raise exception 'This GrowthMission order is complete, so only CRO Leader can change it.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Completing it, or delegating an order that is already complete.
  if new.delegated and new.state = 'complete' then
    raise exception 'Only CRO Leader can confirm a GrowthMission order complete.' using errcode = '42501';
  end if;

  -- Taking it back, or retiring it, once CRO Leader has started.
  if old.delegated and old.state <> 'active'
     and (not new.delegated or (new.archived_at is not null and old.archived_at is null)) then
    raise exception 'CRO Leader has started this GrowthMission order, so it can no longer be taken back.' using errcode = '42501';
  end if;

  return new;
end;
$$;
