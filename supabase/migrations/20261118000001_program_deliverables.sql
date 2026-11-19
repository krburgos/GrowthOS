-- Next Deliverables on the TacticalLeads report (client-confirmed 2026-11-18,
-- approved mockup "Next Deliverables Mockup").
--
-- 1. program_deliverables: the client's action items (ICP development, list
--    building, throwaway domain setup & access, email warmup, …). They belong
--    to the account, not to a month, and carry over until they're Done. Only
--    CRO Admin and CRO Advisor read or write them; the client sees the copy
--    frozen into each published month (2). Removing an item archives it —
--    nothing is hard-deleted, so there is no DELETE policy.
-- 2. tactical_reports.deliverables: the list as it stood when the month was
--    published. Publish changes refreshes it.
-- 3. tactical_deliverables(): what a month's report shows — every open item,
--    plus items finished that month or later. Items finished in earlier
--    months drop off.

-- ---- 1. program_deliverables -------------------------------------------

create table program_deliverables (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  program text not null default 'tactical_leads' check (program in ('tactical_leads')),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  waiting_on text not null default 'cro_leader' check (waiting_on in ('cro_leader', 'client')),
  due_date date,
  note text check (note is null or length(note) <= 300),
  -- Set by the trigger below when the status becomes Done, cleared when it stops being Done.
  done_at timestamptz,
  position integer not null default 0,
  archived_at timestamptz,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index program_deliverables_account_idx on program_deliverables (account_id, program) where archived_at is null;

create trigger trg_program_deliverables_updated_at before update on program_deliverables
  for each row execute function set_updated_at();

create or replace function program_deliverables_done_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'done' then
    if tg_op = 'UPDATE' and old.status = 'done' and old.done_at is not null then
      new.done_at := old.done_at;
    else
      new.done_at := now();
    end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_program_deliverables_done_at before insert or update on program_deliverables
  for each row execute function program_deliverables_done_at();

alter table program_deliverables enable row level security;

create policy program_deliverables_select on program_deliverables for select
  using ((select auth_has_any_role('cro_admin', 'cro_advisor')));
create policy program_deliverables_insert on program_deliverables for insert
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));
create policy program_deliverables_update on program_deliverables for update
  using ((select auth_has_any_role('cro_admin', 'cro_advisor')))
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));

grant select, insert, update on program_deliverables to authenticated;
grant all on program_deliverables to service_role;

-- ---- 2. tactical_reports.deliverables ----------------------------------

alter table tactical_reports add column deliverables jsonb;

comment on column tactical_reports.deliverables is
  'Next Deliverables as they stood at publish (tactical_deliverables()). Null for months published before 2026-11-18.';

-- ---- 3. tactical_deliverables() ----------------------------------------

-- Security invoker: RLS decides what the caller can read (CRO Admin/Advisor).
create or replace function tactical_deliverables(p_account_id uuid, p_month date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', d.name,
      'status', d.status,
      'waiting_on', d.waiting_on,
      'due_date', d.due_date,
      'note', d.note,
      'done_at', d.done_at
    ) order by d.position, d.created_at), '[]'::jsonb)
  from program_deliverables d
  where d.account_id = p_account_id
    and d.program = 'tactical_leads'
    and d.archived_at is null
    and (d.status <> 'done' or d.done_at >= p_month::timestamp at time zone 'UTC');
$$;

grant execute on function tactical_deliverables(uuid, date) to authenticated, service_role;
