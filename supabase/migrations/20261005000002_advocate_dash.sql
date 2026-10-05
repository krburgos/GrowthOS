-- AdvocateDash (client-confirmed, 2026-10-05).
--
-- A drop-by service: an Advocate visits a target account in person, leaves
-- the drop-by letter, and files a VictoryVisit After-Action Report back to
-- the MSP Owner. Sourced from the client's own two documents, delivered the
-- same day -- "AdvocateDash Dropby letter.docx" and "Victory Visit
-- Report.pdf" (a completed report for ABTech - Boston).
--
-- FOUR RECORDED DEPARTURES. None of the six source documents mentions this
-- workstream, so most of what follows fills a gap rather than contradicting
-- a decision. These four are worth naming because they do cut across
-- something already written down:
--
-- 1. MEASURED IN DROP-BYS, NOT HOURS (client-confirmed). Every other
--    workstream is hours-measured -- gos_dashboard_step_hours plus the
--    quarter triad the Mission Card shows. AdvocateDash carries no hours
--    row that anyone reads; its card counts targets, scheduled visits and
--    completed drop-bys, and it is left out of the Command Center's
--    quarter hours strip rather than summed in as a zero.
--
-- 2. TARGETS, NOT TASKS (client-confirmed). The workstream page shows this
--    table instead of gos_dashboard_tasks, and its button says "Add
--    target". The columns do not map onto a task row -- a target has an
--    address, an advocate, a delivered letter and a visit report, and its
--    three states are Assigned / Scheduled / Completed.
--
-- 3. A RUNNING LIST, NOT QUARTER-SCOPED (client-confirmed). Targets
--    accumulate and keep their reports. There is deliberately no quarter
--    column: a drop-by done in July still reads in October, which is the
--    opposite of how hours behave.
--
-- 4. TWO MORE FILE EXCEPTIONS (client-confirmed). Backend Schema §12 and
--    PRD §6.8/§10 rule out attachments for Phase 1. Five exceptions exist
--    already -- company logo, user avatar, contact avatar, CRM company
--    logo, and the workstream-reports bucket. The delivered letter is the
--    sixth and the visit photos are the seventh. The photos one was put to
--    the client directly, since the alternative was keeping the report's
--    Photo & Verification section as bare checkboxes; they chose upload.
--    Both stay narrow: a file may be attached to an AdvocateDash target and
--    to nothing else.

create type advocate_dash_target_status as enum ('assigned', 'scheduled', 'completed');

-- One row per drop-by. `target_name` and `company_name` are free text
-- (client-confirmed) rather than references to contacts/companies: a target
-- is a prospect nobody has necessarily put in the CRM yet, and the client
-- asked for text. Linking the two is a later decision, not a closed door.
create table advocate_dash_targets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  target_name text not null check (length(trim(target_name)) > 0),
  company_name text,
  -- Rendered as a Google Maps link, so it is one free-text line exactly as
  -- somebody would write it on the paper form.
  address text,
  -- The Advocate, drawn from the Company Profile's roster. Usually an
  -- "outsourced" member (CRO Leader or a trained third party), but an
  -- in-house member is allowed -- the client's own framing was "CRO Leader
  -- or we can train someone else to do it". Null until assigned.
  advocate_member_id uuid references account_team_members(id) on delete set null,
  status advocate_dash_target_status not null default 'assigned',
  -- The date the drop-by happened. Set when status reaches 'completed';
  -- this is the "Done" column and what the card's Completed figure counts.
  completed_on date,
  -- The drop-by letter actually delivered to this target, uploaded per
  -- target (client-confirmed) into the advocate-dash-letters bucket.
  letter_path text unique,
  letter_name text,
  letter_size integer,
  letter_uploaded_at timestamptz,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete, repo-wide rule. Opportunities are the only table that
  -- opts out of this, and only because they are retained permanently.
  archived_at timestamptz
);

create index advocate_dash_targets_account_idx
  on advocate_dash_targets(account_id, created_at desc);
create index advocate_dash_targets_advocate_idx
  on advocate_dash_targets(advocate_member_id);

-- The VictoryVisit After-Action Report, one per target.
--
-- All seventeen sections of the client's document live in `answers`, keyed
-- by the stable field keys in lib/advocate-dash/report-form.ts -- the same
-- "structure in code, answers in jsonb" split as growth_questionnaire_
-- responses and vision_board_responses (Backend Schema §6.6a). The document
-- has ~55 checkboxes and ~15 free-text fields across those sections; one
-- column each would be seventy columns and a migration every time the
-- client revises the form, which is exactly the reasoning recorded on the
-- questionnaire table.
--
-- `submitted_at` is the advocate signing it off. Before that it is a draft
-- and the MSP sees "In progress" rather than a report.
create table advocate_dash_visit_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  target_id uuid not null unique references advocate_dash_targets(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advocate_dash_visit_reports_account_idx
  on advocate_dash_visit_reports(account_id);

-- The report's Photo & Verification section. A row per photo rather than
-- paths inside `answers`, so an object has somewhere to record its size and
-- caption and can be retired without rewriting the form payload.
create table advocate_dash_visit_photos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  target_id uuid not null references advocate_dash_targets(id) on delete cascade,
  -- Object path inside advocate-dash-photos, namespaced by account so the
  -- storage policy authorises on the first folder segment with no join.
  file_path text not null unique,
  caption text,
  file_size integer,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index advocate_dash_visit_photos_target_idx
  on advocate_dash_visit_photos(target_id, created_at);

alter table advocate_dash_targets enable row level security;
alter table advocate_dash_visit_reports enable row level security;
alter table advocate_dash_visit_photos enable row level security;

-- Client-confirmed (2026-10-05): MSP Owner/Admin and CRO Leader both edit
-- everything here -- targets, advocate, status, letter and report alike.
-- That is the same write parity growth_questionnaire_responses has, and it
-- is deliberately wider than gos_dashboard_reports, where the typed report
-- was CRO-authored and the MSP read it.
create policy advocate_dash_targets_select on advocate_dash_targets for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy advocate_dash_targets_insert on advocate_dash_targets for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy advocate_dash_targets_update on advocate_dash_targets for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

-- No delete policy: archived_at retires a target.

create policy advocate_dash_visit_reports_select on advocate_dash_visit_reports for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy advocate_dash_visit_reports_insert on advocate_dash_visit_reports for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy advocate_dash_visit_reports_update on advocate_dash_visit_reports for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy advocate_dash_visit_photos_select on advocate_dash_visit_photos for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy advocate_dash_visit_photos_insert on advocate_dash_visit_photos for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy advocate_dash_visit_photos_update on advocate_dash_visit_photos for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create trigger trg_advocate_dash_targets_updated_at before update on advocate_dash_targets
  for each row execute function set_updated_at();
create trigger trg_advocate_dash_visit_reports_updated_at before update on advocate_dash_visit_reports
  for each row execute function set_updated_at();

-- Both buckets are PRIVATE, like workstream-reports and unlike the four
-- image buckets. A drop-by letter names a prospect the MSP is courting and
-- a visit photo is somebody's premises, so a guessable path must be worth
-- nothing to another tenant; reads go through short-lived signed URLs.
--
-- The letter bucket takes PDF and .docx, because the client's own template
-- is a Word file. Only the PDF renders inside the modal; a .docx is offered
-- as a download instead, which is the best the browser can do and is
-- recorded here so it is not mistaken for a bug.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'advocate-dash-letters',
  'advocate-dash-letters',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
), (
  'advocate-dash-photos',
  'advocate-dash-photos',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp']
);

-- Paths are <account_id>/<target_id>/<uuid>.<ext> in both buckets, so the
-- first folder segment is the tenant and the policy needs no join.
--
-- KNOWN GAP, same as workstream-reports (Backend Schema §6.6g): a granted
-- partner can read the table rows but not the objects, because
-- auth_account_id() is their own account, not the one they were granted.
-- Recorded rather than fixed, to keep this consistent with the bucket that
-- already behaves this way.
create policy advocate_dash_letters_select on storage.objects for select
  using (
    bucket_id = 'advocate-dash-letters'
    and ((storage.foldername(name))[1] = auth_account_id()::text or is_cro_leader())
  );

create policy advocate_dash_letters_insert on storage.objects for insert
  with check (
    bucket_id = 'advocate-dash-letters'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );

create policy advocate_dash_letters_update on storage.objects for update
  using (
    bucket_id = 'advocate-dash-letters'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );

-- Replacing a letter leaves no use for the old object, so this bucket does
-- allow delete. The table rows above are still soft-deleted; this is object
-- cleanup, not record deletion.
create policy advocate_dash_letters_delete on storage.objects for delete
  using (
    bucket_id = 'advocate-dash-letters'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );

create policy advocate_dash_photos_select on storage.objects for select
  using (
    bucket_id = 'advocate-dash-photos'
    and ((storage.foldername(name))[1] = auth_account_id()::text or is_cro_leader())
  );

create policy advocate_dash_photos_insert on storage.objects for insert
  with check (
    bucket_id = 'advocate-dash-photos'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );

create policy advocate_dash_photos_update on storage.objects for update
  using (
    bucket_id = 'advocate-dash-photos'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );

create policy advocate_dash_photos_delete on storage.objects for delete
  using (
    bucket_id = 'advocate-dash-photos'
    and (
      ((storage.foldername(name))[1] = auth_account_id()::text
        and auth_has_any_role('msp_owner','msp_admin'))
      or is_cro_leader()
    )
  );
