-- ICP approval (client-confirmed, 2026-10-23, approved mockup "ICP & List
-- Building Cards"): the Ideal Client Profile on Mission Card step 6 is
-- approved by two people, an MSP Owner AND a CRO Admin, on the same
-- answers. One row per sign-off, insert-only: a later sign-off is a new
-- row, so the history of who approved which version stays. A sign-off is
-- current while its answers snapshot still equals the questionnaire's ICP
-- answers (compared in app code, lib/icp/rules.ts); editing the answers
-- therefore resets both slots without touching these rows.
--
-- No UPDATE or DELETE policy (soft delete everywhere; archived_at kept for
-- parity with every other tenant table).

create table icp_approvals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  approved_by uuid not null references users(id),
  approver_role text not null check (approver_role in ('msp_owner', 'cro_admin')),
  answers jsonb not null,
  approved_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index icp_approvals_account_role_idx
  on icp_approvals(account_id, approver_role, approved_at desc) where archived_at is null;

alter table icp_approvals enable row level security;

-- Readable by whoever can read the questionnaire it approves.
create policy icp_approvals_select on icp_approvals for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

-- Each person signs only their own slot: an MSP Owner for their own
-- account, a CRO Admin for any account.
create policy icp_approvals_insert on icp_approvals for insert
  with check (
    approved_by = auth.uid()
    and (
      (approver_role = 'msp_owner' and account_id = auth_account_id() and auth_has_any_role('msp_owner'))
      or (approver_role = 'cro_admin' and auth_has_any_role('cro_admin'))
    )
  );

grant select, insert on icp_approvals to authenticated, service_role;

-- Lists made with Build ICP list carry the ICP chip and drive the
-- List Building card's mission steps. A column on an existing table needs
-- no new grants.
alter table lists add column built_from_icp boolean not null default false;
