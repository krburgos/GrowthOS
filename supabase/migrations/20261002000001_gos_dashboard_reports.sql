-- Client-confirmed (2026-10-02): CRO Leader uploads a PDF report per
-- workstream, the MSP views it in a modal and may download it, and every
-- past report is kept.
--
-- SCOPE NOTE. Backend Schema §12 and PRD §6.8/§10 rule out file attachments
-- for Phase 1. Four exceptions already exist (company logo, user avatar,
-- contact avatar, CRM company logo); each backs a single image field, and
-- §12 says in terms that there is "no general-purpose attachments feature."
--
-- This is a fifth exception and a larger one, because keeping history means
-- a table rather than a column. It is still deliberately narrow: reports
-- only, one workstream each, uploaded by CRO Leader alone, with no way to
-- attach a file to a contact, company, opportunity or task. It is recorded
-- here rather than slipped in, the way the avatar buckets were.
create table gos_dashboard_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  step_slug gos_dashboard_step not null,
  -- What the reader sees in the list: "SEO report — September 2026".
  title text not null check (length(trim(title)) > 0),
  -- Object path inside the workstream-reports bucket, namespaced by
  -- account so the storage policy can authorise without a table lookup.
  file_path text not null unique,
  file_size integer,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- History is kept, so replacing a report archives the old one rather
  -- than deleting it, matching the repo-wide soft-delete rule.
  archived_at timestamptz
);

create index gos_dashboard_reports_account_step_idx
  on gos_dashboard_reports(account_id, step_slug, created_at desc);

alter table gos_dashboard_reports enable row level security;

create policy gos_dashboard_reports_select on gos_dashboard_reports for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

-- CRO Leader publishes the report; the account reads it.
create policy gos_dashboard_reports_insert on gos_dashboard_reports for insert
  with check (auth_has_any_role('cro_admin','cro_advisor'));

create policy gos_dashboard_reports_update on gos_dashboard_reports for update
  using (auth_has_any_role('cro_admin','cro_advisor'));

-- No delete policy: archived_at retires a report.

-- PRIVATE bucket, unlike the four image buckets, which are public. Those
-- hold logos and avatars, which are meant to be fetched by URL. These are a
-- client's own analytics, so a guessable path must not be readable by
-- another tenant; reads go through short-lived signed URLs instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workstream-reports',
  'workstream-reports',
  false,
  26214400, -- 25 MB
  array['application/pdf']
);

-- Path is <account_id>/<step_slug>/<uuid>.pdf, so the first folder segment
-- is the tenant and the policy needs no join.
create policy workstream_reports_select on storage.objects for select
  using (
    bucket_id = 'workstream-reports'
    and (
      (storage.foldername(name))[1] = auth_account_id()::text
      or is_cro_leader()
    )
  );

create policy workstream_reports_insert on storage.objects for insert
  with check (bucket_id = 'workstream-reports' and auth_has_any_role('cro_admin','cro_advisor'));

create policy workstream_reports_update on storage.objects for update
  using (bucket_id = 'workstream-reports' and auth_has_any_role('cro_admin','cro_advisor'));

create policy workstream_reports_delete on storage.objects for delete
  using (bucket_id = 'workstream-reports' and auth_has_any_role('cro_admin','cro_advisor'));
