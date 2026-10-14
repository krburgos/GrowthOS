-- Client-confirmed (2026-10-14, approved mockup "Mission Orders Design"):
-- mission orders get three types and ABC-123 priority. Backend Schema
-- §6.6f amendment.
--
--   Internal     - assigned to an in-house roster member
--   Outsourced   - assigned to an outsourced roster member
--   GrowthMission - delegated to CRO Leader for credits
--
-- Only the third is stored. Internal and Outsourced are the assignee's
-- roster kind, so an order can never disagree with the person it points
-- at. A delegated order has no person.
--
-- Priority keeps the growth_mission_priority enum (high / medium / low),
-- shown as Must / Should / Could. The number in "Must 2" is computed from
-- sort_order within (account, discipline, priority), so it is never stored
-- and cannot duplicate or skip.
--
-- This migration only adds things. The CRO Leader Team data conversion is
-- the separate 20261014000002 migration, applied with the release that
-- reads it.

alter table growth_mission_tasks
  add column delegated boolean not null default false,
  add constraint growth_mission_tasks_delegated_unassigned check (not delegated or assignee_id is null);

-- Renumber 1..n inside each priority group, keeping today's order. The
-- carried-over suggestions kept their old list positions and newer orders
-- all sat at 0, so ties break by age.
with ranked as (
  select id,
         row_number() over (partition by account_id, step_slug, priority order by sort_order, created_at, id) as rn
  from growth_mission_tasks
  where archived_at is null
)
update growth_mission_tasks t set sort_order = r.rn from ranked r where r.id = t.id;

-- A new order, or one moved to another tier or discipline, goes to the
-- bottom of its group.
create or replace function place_mission_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.priority = old.priority and new.step_slug = old.step_slug then
    return new;
  end if;
  select coalesce(max(sort_order), 0) + 1 into new.sort_order
  from growth_mission_tasks
  where account_id = new.account_id
    and step_slug = new.step_slug
    and priority = new.priority
    and archived_at is null
    and id <> new.id;
  return new;
end;
$$;

create trigger trg_growth_mission_tasks_place
  before insert or update of priority, step_slug on growth_mission_tasks
  for each row execute function place_mission_order();

-- The completion rule. RLS decides the row (unchanged); this decides what
-- a non-CRO caller may do to a GrowthMission order, because completing one
-- is what spends credits. Same shape as prevent_self_role_escalation.
create or replace function guard_growthmission_orders()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.delegated then
    new.assignee_id := null;
  end if;

  -- CRO Admin/Advisor, and the service role (no auth.uid), are unrestricted.
  if auth.uid() is null or auth_has_any_role('cro_admin', 'cro_advisor') then
    return new;
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

create trigger trg_growth_mission_tasks_guard
  before insert or update on growth_mission_tasks
  for each row execute function guard_growthmission_orders();

-- Drag to reorder: one statement for the whole group. Security invoker, so
-- RLS still decides which of these rows the caller may update.
create or replace function reorder_mission_orders(p_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update growth_mission_tasks t
  set sort_order = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where t.id = x.id;
$$;

grant execute on function reorder_mission_orders(uuid[]) to authenticated;
