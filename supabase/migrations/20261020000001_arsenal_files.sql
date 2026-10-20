-- Client-confirmed (2026-10-20, approved mockup "The Arsenal"): a file
-- library on each Mission Card. A file belongs to the Mission Card in
-- general, or to one of its Mission Orders.
--
-- This is the eighth exception to the "no file attachments" line of
-- Backend Schema §12 / PRD §10, and the first general one: the client
-- signed off on it as a scope change knowing the previous seven were each
-- bound to a single field. It stays bounded to Mission Cards and their
-- orders; contacts, companies and opportunities still take no files.
--
-- Shaped like growth_mission_reports (§6.6g): rows here, objects in a
-- private bucket namespaced by account, soft delete via archived_at and no
-- delete policy on the table. Write access matches who can edit Mission
-- Orders (growth_mission_tasks' insert/update policies).

create table growth_mission_files (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  step_slug growth_mission_step not null,
  -- Null = the Mission Card's general files. An archived order keeps its
  -- files (the order row is never deleted), so no cascade is needed.
  task_id uuid references growth_mission_tasks(id) on delete set null,
  file_name text not null check (length(trim(file_name)) > 0),
  -- Object path in the mission-files bucket: <account_id>/<step_slug>/<uuid>-<name>.
  file_path text not null unique,
  file_size bigint,
  content_type text,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index growth_mission_files_account_step_idx
  on growth_mission_files(account_id, step_slug, created_at desc) where archived_at is null;
create index growth_mission_files_task_idx on growth_mission_files(task_id) where archived_at is null;

alter table growth_mission_files enable row level security;

create policy growth_mission_files_select on growth_mission_files for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy growth_mission_files_insert on growth_mission_files for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

create policy growth_mission_files_update on growth_mission_files for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

-- 25 MB per file; office documents, PDFs, images and CSV. Programs and
-- scripts are not on the list, so storage refuses them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-files',
  'mission-files',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'text/csv', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
);

create policy mission_files_select on storage.objects for select
  using (
    bucket_id = 'mission-files'
    and (
      (storage.foldername(name))[1] = auth_account_id()::text
      or is_cro_leader()
      or is_partner_for(((storage.foldername(name))[1])::uuid)
    )
  );

create policy mission_files_insert on storage.objects for insert
  with check (
    bucket_id = 'mission-files'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text and auth_has_any_role('msp_owner', 'msp_admin'))
      or auth_has_any_role('cro_admin', 'cro_advisor')
    )
  );

-- Delete only so a failed upload can clean up its object before a row
-- points at it; a saved file is archived through the table, never deleted.
create policy mission_files_delete on storage.objects for delete
  using (
    bucket_id = 'mission-files'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text and auth_has_any_role('msp_owner', 'msp_admin'))
      or auth_has_any_role('cro_admin', 'cro_advisor')
    )
  );
