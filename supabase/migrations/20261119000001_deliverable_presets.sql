-- Editable Next Deliverables presets, one list per client (client-confirmed
-- 2026-11-19, approved mockup "Deliverable Presets Mockup").
--
-- The quick-add chips in the TacticalLeads editor used to be fixed in code
-- (DELIVERABLE_PRESETS). Each client can now have its own list, edited from
-- "Edit presets" by anyone on the CRO Leader team who edits TacticalLeads
-- reports (CRO Admin and CRO Advisor).
--
-- One row per client and program holds the whole ordered list. No row means
-- the client still uses the default list in code. Saving replaces the list in
-- place, so nothing is ever deleted (no DELETE policy). Changing a preset
-- never touches deliverables already added (program_deliverables).

create table program_deliverable_presets (
  account_id uuid not null references accounts(id) on delete cascade,
  program text not null default 'tactical_leads' check (program in ('tactical_leads')),
  names text[] not null default '{}'
    check (cardinality(names) <= 50 and array_position(names, null) is null),
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, program)
);

create trigger trg_program_deliverable_presets_updated_at before update on program_deliverable_presets
  for each row execute function set_updated_at();

alter table program_deliverable_presets enable row level security;

create policy program_deliverable_presets_select on program_deliverable_presets for select
  using ((select auth_has_any_role('cro_admin', 'cro_advisor')));
create policy program_deliverable_presets_insert on program_deliverable_presets for insert
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));
create policy program_deliverable_presets_update on program_deliverable_presets for update
  using ((select auth_has_any_role('cro_admin', 'cro_advisor')))
  with check ((select auth_has_any_role('cro_admin', 'cro_advisor')));

grant select, insert, update on program_deliverable_presets to authenticated;
grant all on program_deliverable_presets to service_role;
