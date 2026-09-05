GrowthOS Backend Schema Document
**Purpose:** the complete Supabase/Postgres backend specification for GrowthOS Phase 1 — every table, relationship, authentication and authorization flow, Row Level Security policy, database function and trigger, and the API endpoints that sit alongside direct-to-Supabase access. This is the fifth document in the build-input series (Product Requirements Document → App Flow Document → Tech Stack Lockfile → Design System → Backend Schema) and is written to be implemented literally: Claude Code should not need to invent a table, column, policy, or endpoint that isn't already specified here.
**Source alignment:** table names, status pipelines, and role names below match the terminology already locked in the PRD (§4 Users/Roles, §6 Functional Requirements, §7 Data Model Overview) and the App Flow Document (§4.5 Opportunities, §4.7 Campaigns). Where this document had to introduce a name, table, or structure the earlier documents didn't specify, that's called out explicitly in §12 rather than left implicit.

## 1. Purpose & Architecture Overview

| **Layer** | **Technology / Approach** |
| --- | --- |
| Database | Supabase Postgres — one shared schema (public), multi-tenant via Row Level Security |
| Auth | Supabase Auth (auth.users), extended by a 1:1 public.users profile table |
| Data access | Hybrid — direct browser-to-Supabase for simple CRUD (RLS-protected), Next.js API routes with the Supabase service role for anything needing secrets or multi-step server logic |
| Scheduled jobs | pg_cron (in-database scheduler) + pg_net (HTTP calls from Postgres), handing off actual email sending to a Next.js API route |
| Email delivery | Nodemailer over SendGrid SMTP relay (Tech Stack Lockfile §3.8), triggered by that API route — Postgres never sends email directly |

Two extensions beyond the Postgres defaults are required: pg_cron and pg_net. Both must be turned on from the Supabase dashboard (Database → Extensions) before running the migration in §5 — create extension can fail silently on hosted Supabase if the extension isn't allow-listed for the project tier, so this is called out here rather than assumed.
Twelve database tables cover Phase 1 in full: accounts, users, email_connections, companies, contact_statuses, contacts, lists, list_members, opportunities, activities, campaigns, campaign_recipients, campaign_events — thirteen, including the event log. No table exists for file attachments, custom fields, audit logging, or a client portal; §12 records why each of those is deliberately absent.

## 2. Multi-Tenancy & Data Access Model

GrowthOS uses **one shared schema with application-level isolation enforced by Row Level Security** — not a separate database or schema per MSP. The PRD (§5, §9) confirms no compliance driver currently requires stricter isolation than that; if one emerges later, RLS can be tightened without a data migration.
**Tenant unit.** A tenant is an accounts row — one MSP. Every tenant-scoped table carries an account_id column and an RLS policy that compares it against the caller's own account.
**Two categories of user:**
- **MSP staff** (msp_owner, msp_admin, msp_sales, msp_marketing, msp_read_only) — always belong to exactly one account; users.account_id is required (not null) for these roles.
- **CRO Leader staff** (cro_admin, cro_advisor, cro_service_team) — belong to no single account and can act across all of them; users.account_id is required to be null for these roles. This is enforced by a CHECK constraint on users (§5), not left to application code to get right.
**Permission matrix.** The PRD's role table (§4) specifies view/edit access per role but only as a single combined "Own account data" description per row. To turn that into concrete per-table RLS policies, this document treats **view (SELECT) as broad** — any role with access to an account can see all of that account's CRM data, since the App Flow Document already assumes cross-navigation (a Sales user needs to see which list a contact belongs to; Marketing needs to see opportunity outcomes to judge campaign impact) — and treats **edit (INSERT/UPDATE) as the PRD's specific per-role grant, applied literally**. This interpretation is flagged as an assumption in §12 for the client to confirm; if narrower view access turns out to be intended, only the SELECT policies in §6 need to change.
| **Resource** | **View** | **Edit** |
| --- | --- | --- |
| Companies, Contacts, Contact Statuses | All roles in the account; all CRO Leader roles | Owner, Admin, Sales, Marketing (own account) · CRO Admin, CRO Advisor (any account). Contact Statuses management is Owner/Admin/CRO Admin/CRO Advisor only. |
| Opportunities, Activities | All roles in the account; all CRO Leader roles | Owner, Admin, Sales (own account) · CRO Admin, CRO Advisor (any account) |
| Lists, List Members, Campaigns, Campaign Recipients | All roles in the account; all CRO Leader roles | Owner, Admin, Marketing (own account) · CRO Admin, CRO Advisor (any account) |
| Users (own account roster) | All roles in the account; all CRO Leader roles | Owner, Admin (own account, cannot touch CRO Leader-role rows) · CRO Admin (any account) |
| Accounts (own account settings) | Own account; all CRO Leader roles | Owner, Admin (own account) · CRO Admin, CRO Advisor (any account) |
| Email Connections | Only the connecting user — no exception, including for CRO Leader roles | Only the connecting user |
| Campaign Events (tracking log) | All roles in the account; all CRO Leader roles | System only — written exclusively by record_campaign_event() (§7) via the public tracking/webhook routes, never by a client |

**Soft delete, with one exception.** Per the client's decision, nothing in GrowthOS is hard-deleted — every tenant-scoped table has an archived_at timestamp, no DELETE RLS policy is ever granted, and "delete" in the UI always means "set archived_at." **Opportunities are the one exception:** the PRD (§6.4) requires every opportunity retained permanently, so the opportunities table has **no ****archived_at**** column at all** — there is no way to archive or hide one, by design.

## 3. Authentication & User Lifecycle

**Login vs. OAuth are two separate things.** Standard email/password (Supabase Auth) is how every user logs into GrowthOS. The Microsoft 365 / Google Workspace OAuth flow (§7, §10) is unrelated to login — it only connects a mailbox for sending campaigns, and is optional per user. The PRD (§4) confirms formal SSO/Entra ID federation is not required for Phase 1.
**Provisioning has no self-service signup.** New users are always invited, never self-registered:
- An authorized inviter (Owner/Admin for their own account, or a CRO Admin for any account) submits the invite through POST /api/users/invite (§10).
- That route calls supabase.auth.admin.inviteUserByEmail() with the target account_id and role embedded in raw_user_meta_data, using the service role key — this cannot happen from the browser since it requires an admin-privileged Supabase Auth call.
- Supabase sends the invite email; the recipient sets their password and lands in the app already provisioned.
- A handle_new_user() trigger (§7) on auth.users copies id, account_id, role, and full_name into public.users the moment the auth record is created — there is deliberately no client-side INSERT policy on public.users; rows can only be created by this trigger.
**Deactivation** sets users.archived_at. Because a valid JWT stays valid until it expires regardless of that flag, the deactivation route must _also_ call the Supabase Auth Admin API to invalidate the user's active sessions — setting archived_at alone is not sufficient to immediately cut off access, and this is called out here so it isn't missed during implementation.
**Last login** is read live from auth.users.last_sign_in_at rather than duplicated onto public.users — that column is the single source of truth and Supabase already maintains it. Since auth.users isn't directly queryable under RLS from the client, a SECURITY DEFINER function exposes it per the same account-scoping rules as everything else (§7, get_users_with_last_login).
**Role changes** happen through UPDATE users SET role = ..., gated by the same RLS policy as any other user-record edit (§6) plus a trigger, prevent_self_role_escalation() (§7), that blocks a non-admin from changing their own role or account.

## 4. Entity Relationship Summary

| **Table** | **Belongs to** | **References** |
| --- | --- | --- |
| accounts | — (tenant root) | — |
| users | accounts (nullable, for CRO Leader roles) | — |
| email_connections | users | — |
| companies | accounts | — |
| contact_statuses | accounts | — |
| contacts | accounts | companies, contact_statuses, users (owner) |
| lists | accounts | users (created_by) |
| list_members | lists, contacts (join table) | users (added_by) |
| opportunities | accounts | contacts, companies (denormalized), users (owner) |
| activities | accounts | contacts, opportunities (at least one required), users |
| campaigns | accounts | lists, email_connections, users (created_by) |
| campaign_recipients | campaigns | contacts |
| campaign_events | campaign_recipients | — |

A prospect and a contact are the same row — the PRD's "Prospect/Company" and "Contact" entities merge into a single contacts table (per the client's confirmation), distinguished only by which contact_statuses row they currently sit in.

## 5. Database Schema (Full SQL DDL)

Run in order — extensions and enums first, then tables in dependency order. This section is structural only; every trigger referenced here is defined in §7 and bound to these tables there.

### 5.1 Extensions & Enums

```
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;    -- enable via Supabase Dashboard → Database → Extensions if this errors
create extension if not exists pg_net;     -- enable via Supabase Dashboard → Database → Extensions if this errors

create type user_role as enum (
  'msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'msp_read_only',
  'cro_admin', 'cro_advisor', 'cro_service_team'
);

create type contact_source as enum ('import', 'manual');

create type email_provider as enum ('google', 'microsoft');

create type connection_status as enum ('connected', 'error', 'disconnected');

create type activity_type as enum ('call', 'email', 'meeting', 'task', 'note');

-- Order matters: this is the literal left-to-right pipeline from the Developer Brief §16.4.
create type opportunity_stage as enum (
  'identified_interest', 'discovery_scheduled', 'discovery_completed', 'solution_alignment',
  'proposal_development', 'proposal_delivered', 'negotiation', 'verbal_commitment',
  'contract_sent', 'closed_won', 'closed_lost', 'ghosted', 'on_hold'
);

create type list_type as enum ('static', 'smart');

create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');

create type recipient_status as enum ('pending', 'sent', 'failed', 'bounced', 'unsubscribed');

create type campaign_event_type as enum (
  'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained'
);
```


### 5.2 accounts, users, email_connections

```
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  archived_at timestamptz,  -- kept for schema consistency; PRD §6.9 retains offboarded accounts indefinitely and no Phase 1 UI action sets this
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid references accounts(id),
  role user_role not null,
  full_name text not null,
  email text not null,
  avatar_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_account_id_matches_role check (
    (role in ('cro_admin','cro_advisor','cro_service_team') and account_id is null)
    or
    (role in ('msp_owner','msp_admin','msp_sales','msp_marketing','msp_read_only') and account_id is not null)
  )
);
create index users_account_id_idx on users(account_id);

create table email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider email_provider not null,
  email_address text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  status connection_status not null default 'connected',
  last_synced_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Only one active mailbox connection per user in Phase 1.
create unique index email_connections_one_active_per_user
  on email_connections(user_id) where archived_at is null;
```

Tokens are encrypted application-side (AES-256-GCM, Node.js crypto, key from the TOKEN_ENCRYPTION_KEY environment variable — §12) before being written to access_token_encrypted / refresh_token_encrypted. Postgres never sees a plaintext token; there's no pgsodium/Vault dependency because these tokens are only ever consumed by the Node.js server, never by a database function.

### 5.3 companies, contact_statuses, contacts

```
create table companies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  name text not null,
  domain text,
  website text,
  industry text,
  geography text,
  company_size text,
  revenue text,
  technology_profile text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_account_id_idx on companies(account_id);
-- Domain-based auto-dedup: one non-archived company per (account, domain).
create unique index companies_account_domain_unique
  on companies(account_id, domain) where domain is not null and archived_at is null;

create table contact_statuses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  name text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_statuses_account_id_idx on contact_statuses(account_id);
create unique index contact_statuses_account_name_unique
  on contact_statuses(account_id, lower(name)) where archived_at is null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  company_id uuid references companies(id),
  owner_id uuid references users(id),
  status_id uuid not null references contact_statuses(id),
  full_name text not null,
  title text,
  email text not null,
  phone text,
  source contact_source not null default 'manual',
  notes text,
  email_opt_out boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_account_id_idx on contacts(account_id);
create index contacts_company_id_idx on contacts(company_id);
create index contacts_status_id_idx on contacts(status_id);
create index contacts_owner_id_idx on contacts(owner_id);
-- Dedup rule (PRD §6.1): exact, case-insensitive email match within an account.
create unique index contacts_account_email_unique
  on contacts(account_id, lower(email)) where archived_at is null;
```

email_opt_out is this document's one addition to the field list in PRD §6.1 — it's required to honor unsubscribes (§9) and isn't a design decision so much as a mechanical necessity of that flow; flagged in §12.

### 5.4 lists, list_members

```
create table lists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  name text not null,
  type list_type not null default 'static',
  criteria jsonb,
  created_by uuid references users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_criteria_only_for_smart check (
    (type = 'smart' and criteria is not null) or (type = 'static' and criteria is null)
  )
);
create index lists_account_id_idx on lists(account_id);

create table list_members (
  list_id uuid not null references lists(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references users(id),
  primary key (list_id, contact_id)
);
create index list_members_contact_id_idx on list_members(contact_id);
```

list_members only ever holds rows for static lists — a smart list's members are computed live by compute_smart_list_members() (§7) and never stored. The criteria JSONB schema is defined precisely in §7 alongside the function that evaluates it.

### 5.5 opportunities, activities

```
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  contact_id uuid not null references contacts(id),
  company_id uuid references companies(id),
  owner_id uuid references users(id),
  stage opportunity_stage not null default 'identified_interest',
  name text,
  value numeric(12,2),
  source text,
  notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- No archived_at: PRD §6.4 requires every opportunity retained permanently, never archived or deleted.
);
create index opportunities_account_id_idx on opportunities(account_id);
create index opportunities_contact_id_idx on opportunities(contact_id);
create index opportunities_company_id_idx on opportunities(company_id);
create index opportunities_stage_idx on opportunities(account_id, stage);

create table activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  contact_id uuid references contacts(id),
  opportunity_id uuid references opportunities(id),
  user_id uuid references users(id),
  type activity_type not null,
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_needs_a_parent check (contact_id is not null or opportunity_id is not null)
);
create index activities_account_id_idx on activities(account_id);
create index activities_contact_id_idx on activities(contact_id);
create index activities_opportunity_id_idx on activities(opportunity_id);
create index activities_occurred_at_idx on activities(account_id, occurred_at desc);
```

opportunities.company_id is denormalized from contacts.company_id (kept in sync by sync_opportunity_company(), §7) purely so the Opportunity Board and reports can filter/group by company without a join through contacts on every query.

### 5.6 campaigns, campaign_recipients, campaign_events

```
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  list_id uuid not null references lists(id),
  created_by uuid references users(id),
  send_from_connection_id uuid references email_connections(id),
  name text not null,
  subject text not null,
  body text not null,
  status campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_account_id_idx on campaigns(account_id);
create index campaigns_status_scheduled_idx on campaigns(status, scheduled_at) where status = 'scheduled';

create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  tracking_token uuid not null default gen_random_uuid(),
  status recipient_status not null default 'pending',
  sent_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id),
  unique (tracking_token)
);
create index campaign_recipients_campaign_id_idx on campaign_recipients(campaign_id);

create table campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_recipient_id uuid not null references campaign_recipients(id) on delete cascade,
  event_type campaign_event_type not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index campaign_events_recipient_id_idx on campaign_events(campaign_recipient_id);
```

campaign_recipients carries denormalized counters (open_count, click_count, first-touch timestamps) for fast list/table rendering; campaign_events is the append-only, per-event log those counters are rolled up from. Neither list_members nor campaign_events has an updated_at column — both are append-only by design, never edited in place.

## 6. Row Level Security Policies (SQL)


### 6.1 Helper Functions

Every policy below is built from four small helpers, so the account-scoping and role-checking logic exists in exactly one place each rather than being re-typed into every policy.
```
create or replace function auth_account_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select account_id from public.users where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function is_cro_leader()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth_role() in ('cro_admin', 'cro_advisor', 'cro_service_team');
$$;

create or replace function auth_has_any_role(variadic roles user_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth_role() = any(roles);
$$;
```

These are security definer so they can read public.users (itself RLS-protected) without triggering recursive policy evaluation — the standard Supabase pattern for role-lookup helpers.

### 6.2 accounts, users

```
alter table accounts enable row level security;

create policy accounts_select on accounts for select
  using (id = auth_account_id() or is_cro_leader());

create policy accounts_update on accounts for update
  using (
    (id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );
-- No insert/delete policy: new accounts are created only via POST /api/accounts (service role, §10);
-- accounts are never deleted.

alter table users enable row level security;

create policy users_select on users for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy users_update on users for update
  using (
    id = auth.uid()
    or (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin')
  );
-- No insert/delete policy: rows are created only by handle_new_user() (§7) and never hard-deleted;
-- "delete" is archived_at through the update policy above. The trg_prevent_self_role_escalation
-- trigger (§7) stops a non-admin from editing their own role/account_id through this same policy.
```


### 6.3 email_connections

```
alter table email_connections enable row level security;

create policy email_connections_select on email_connections for select
  using (user_id = auth.uid());

create policy email_connections_insert on email_connections for insert
  with check (user_id = auth.uid());

create policy email_connections_update on email_connections for update
  using (user_id = auth.uid());
-- Deliberately no CRO Leader bypass anywhere in this table, per the client's explicit decision:
-- a connected mailbox and its tokens are strictly the connecting user's own.
```


### 6.4 companies, contact_statuses, contacts

```
alter table companies enable row level security;

create policy companies_select on companies for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy companies_insert on companies for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy companies_update on companies for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table contact_statuses enable row level security;

create policy contact_statuses_select on contact_statuses for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy contact_statuses_insert on contact_statuses for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy contact_statuses_update on contact_statuses for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table contacts enable row level security;

create policy contacts_select on contacts for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy contacts_insert on contacts for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy contacts_update on contacts for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );
```

No table in this section grants delete — every removal is an update that sets archived_at.

### 6.5 lists, list_members, opportunities, activities

```
alter table lists enable row level security;

create policy lists_select on lists for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy lists_insert on lists for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy lists_update on lists for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table list_members enable row level security;

-- list_members has no account_id column; scope through its parent list.
create policy list_members_select on list_members for select
  using (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (l.account_id = auth_account_id() or is_cro_leader())
    )
  );

create policy list_members_insert on list_members for insert
  with check (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
          or auth_has_any_role('cro_admin','cro_advisor')
        )
    )
  );

create policy list_members_delete on list_members for delete
  using (
    exists (
      select 1 from lists l where l.id = list_members.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
          or auth_has_any_role('cro_admin','cro_advisor')
        )
    )
  );
-- list_members is the one join table that DOES get a delete policy: removing a contact from a
-- static list is a real removal (no soft-delete concept applies to list membership), not an archive.

alter table opportunities enable row level security;

create policy opportunities_select on opportunities for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy opportunities_insert on opportunities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy opportunities_update on opportunities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );
-- No delete policy — and no archived_at column to set anyway; opportunities are permanent (§2, §5.5).

alter table activities enable row level security;

create policy activities_select on activities for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy activities_insert on activities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy activities_update on activities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_sales'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );
```


### 6.6 campaigns, campaign_recipients, campaign_events

```
alter table campaigns enable row level security;

create policy campaigns_select on campaigns for select
  using (account_id = auth_account_id() or is_cro_leader());

create policy campaigns_insert on campaigns for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

create policy campaigns_update on campaigns for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
  );

alter table campaign_recipients enable row level security;

create policy campaign_recipients_select on campaign_recipients for select
  using (
    exists (
      select 1 from campaigns c where c.id = campaign_recipients.campaign_id
        and (c.account_id = auth_account_id() or is_cro_leader())
    )
  );
-- No client-side insert/update policy: recipients are populated and updated exclusively by the
-- send-due-campaigns flow (§8) and record_campaign_event() (§7, §9), both running under the
-- service role, which bypasses RLS entirely.

alter table campaign_events enable row level security;

create policy campaign_events_select on campaign_events for select
  using (
    exists (
      select 1 from campaign_recipients cr
        join campaigns c on c.id = cr.campaign_id
        where cr.id = campaign_events.campaign_recipient_id
        and (c.account_id = auth_account_id() or is_cro_leader())
    )
  );
-- No client-side write policy at all: every row is written by record_campaign_event() (§7)
-- through the public tracking/webhook routes (§9, §10), which use the service role.
```


## 7. Database Functions & Triggers (SQL)


### 7.1 updated_at maintenance

```
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_accounts_updated_at before update on accounts for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users for each row execute function set_updated_at();
create trigger trg_email_connections_updated_at before update on email_connections for each row execute function set_updated_at();
create trigger trg_companies_updated_at before update on companies for each row execute function set_updated_at();
create trigger trg_contact_statuses_updated_at before update on contact_statuses for each row execute function set_updated_at();
create trigger trg_contacts_updated_at before update on contacts for each row execute function set_updated_at();
create trigger trg_lists_updated_at before update on lists for each row execute function set_updated_at();
create trigger trg_opportunities_updated_at before update on opportunities for each row execute function set_updated_at();
create trigger trg_activities_updated_at before update on activities for each row execute function set_updated_at();
create trigger trg_campaigns_updated_at before update on campaigns for each row execute function set_updated_at();
create trigger trg_campaign_recipients_updated_at before update on campaign_recipients for each row execute function set_updated_at();
```

list_members and campaign_events are intentionally omitted — both are append-only and have no updated_at column (§5.4, §5.6).

### 7.2 Auth lifecycle: handle_new_user, sync_user_email, prevent_self_role_escalation

```
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, account_id, role, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'account_id', '')::uuid,
    (new.raw_user_meta_data->>'role')::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function sync_user_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.users set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

create trigger trg_sync_user_email
  after update of email on auth.users
  for each row execute function sync_user_email();

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.id
     and (new.role is distinct from old.role or new.account_id is distinct from old.account_id)
     and not auth_has_any_role('msp_owner', 'msp_admin', 'cro_admin') then
    raise exception 'You cannot change your own role or account.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
  before update on users
  for each row execute function prevent_self_role_escalation();
-- Called by the user-management screen instead of exposing auth.users directly.
create or replace function get_users_with_last_login(p_account_id uuid default null)
returns table(user_id uuid, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if p_account_id is not null and p_account_id != auth_account_id() and not is_cro_leader() then
    raise exception 'Not authorized to view this account''s users.';
  end if;
  return query
    select u.id, au.last_sign_in_at
    from public.users u
    join auth.users au on au.id = u.id
    where (p_account_id is null or u.account_id = p_account_id)
      and (u.account_id = auth_account_id() or is_cro_leader());
end;
$$;
```


### 7.3 Company matching: normalize_company_domain, match_or_create_company, merge_companies

```
create or replace function normalize_company_domain()
returns trigger
language plpgsql
as $$
begin
  if new.domain is not null then
    new.domain := lower(regexp_replace(trim(new.domain), '^(https?://)?(www\.)?', ''));
    new.domain := split_part(new.domain, '/', 1);
    if new.domain = '' then
      new.domain := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_normalize_company_domain
  before insert or update of domain on companies
  for each row execute function normalize_company_domain();

-- Auto-match by domain, else create a new company row — the client's confirmed dedup rule.
create or replace function match_or_create_company(
  p_account_id uuid,
  p_name text,
  p_domain text default null
)
returns uuid
language plpgsql security invoker
as $$
declare
  v_domain text;
  v_company_id uuid;
begin
  if p_domain is not null then
    v_domain := lower(regexp_replace(trim(p_domain), '^(https?://)?(www\.)?', ''));
    v_domain := split_part(v_domain, '/', 1);
    if v_domain = '' then v_domain := null; end if;
  end if;

  if v_domain is not null then
    select id into v_company_id from companies
      where account_id = p_account_id and domain = v_domain and archived_at is null
      limit 1;
  end if;

  if v_company_id is null then
    insert into companies (account_id, name, domain)
    values (p_account_id, p_name, v_domain)
    returning id into v_company_id;
  end if;

  return v_company_id;
end;
$$;

-- Manual merge, for the cases auto-match can't resolve (no domain, or two records that
-- should be one despite different domains).
create or replace function merge_companies(
  p_source_company_id uuid,
  p_target_company_id uuid
)
returns void
language plpgsql security invoker
as $$
begin
  update contacts set company_id = p_target_company_id where company_id = p_source_company_id;
  update opportunities set company_id = p_target_company_id where company_id = p_source_company_id;
  update companies set archived_at = now() where id = p_source_company_id;
end;
$$;
```

match_or_create_company and merge_companies both run security invoker — RLS on contacts, opportunities, and companies still applies under the caller's own session, so a caller can only merge or reassign records they already have edit rights to.

### 7.4 Opportunity/list mechanics: sync_opportunity_company, enforce_static_list_membership, compute_smart_list_members

```
create or replace function sync_opportunity_company()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id from contacts where id = new.contact_id;
  return new;
end;
$$;

create trigger trg_sync_opportunity_company
  before insert or update of contact_id on opportunities
  for each row execute function sync_opportunity_company();

create or replace function enforce_static_list_membership()
returns trigger
language plpgsql
as $$
declare
  v_type list_type;
begin
  select type into v_type from lists where id = new.list_id;
  if v_type <> 'static' then
    raise exception 'Contacts can only be added directly to static lists; smart lists compute their members live.';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_static_list_membership
  before insert on list_members
  for each row execute function enforce_static_list_membership();
```

**Smart list criteria schema.** A smart list's criteria column holds a small, fixed-shape JSON object — never raw SQL or free text — so it can be evaluated safely:
```
{
  "match": "all",
  "conditions": [
    { "field": "status_id", "op": "eq", "value": "3fae2b10-9c2e-4b1a-8e2a-2f6b4a1c9d10" },
    { "field": "title", "op": "contains", "value": "CTO" },
    { "field": "created_at", "op": "after", "value": "2026-01-01" }
  ]
}
```

match is "all" (AND) or "any" (OR). Each condition's field must be one of status_id, owner_id, company_id, source, title, email, created_at; op must be one of eq, neq, contains (text only), before, after (timestamps only). Both lists are enforced as whitelists inside the function below — an unrecognized field or operator raises an exception rather than being passed through, and only the condition's value is ever interpolated into the generated query, always through format()'s %L (literal-escaping) placeholder.
```
create or replace function compute_smart_list_members(p_list_id uuid)
returns table(contact_id uuid)
language plpgsql security invoker
as $$
declare
  v_criteria jsonb;
  v_account_id uuid;
  v_match text;
  v_condition jsonb;
  v_field text;
  v_op text;
  v_value text;
  v_sql_field text;
  v_sql_op text;
  v_clause text;
  v_clauses text[] := array[]::text[];
  v_join_word text;
  v_where text;
begin
  select criteria, account_id into v_criteria, v_account_id from lists where id = p_list_id and type = 'smart';
  if v_criteria is null then
    raise exception 'List % is not a smart list or has no criteria', p_list_id;
  end if;

  v_match := coalesce(v_criteria->>'match', 'all');
  v_join_word := case when v_match = 'any' then ' or ' else ' and ' end;

  for v_condition in select * from jsonb_array_elements(v_criteria->'conditions') loop
    v_field := v_condition->>'field';
    v_op := v_condition->>'op';
    v_value := v_condition->>'value';

    v_sql_field := case v_field
      when 'status_id' then 'status_id'
      when 'owner_id' then 'owner_id'
      when 'company_id' then 'company_id'
      when 'source' then 'source::text'
      when 'title' then 'title'
      when 'email' then 'email'
      when 'created_at' then 'created_at'
      else null
    end;
    if v_sql_field is null then
      raise exception 'Smart list condition references an unsupported field: %', v_field;
    end if;

    v_sql_op := case v_op
      when 'eq' then '='
      when 'neq' then '<>'
      when 'contains' then 'ilike'
      when 'before' then '<'
      when 'after' then '>'
      else null
    end;
    if v_sql_op is null then
      raise exception 'Smart list condition uses an unsupported operator: %', v_op;
    end if;

    if v_op = 'contains' then
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, '%' || v_value || '%');
    else
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, v_value);
    end if;

    v_clauses := array_append(v_clauses, v_clause);
  end loop;

  if array_length(v_clauses, 1) is null then
    v_where := 'true';
  else
    v_where := array_to_string(v_clauses, v_join_word);
  end if;

  return query execute format(
    'select id from contacts where account_id = %L and archived_at is null and (%s)',
    v_account_id, v_where
  );
end;
$$;
```

This function does build and execute a dynamic query, but it's safe: v_sql_field and v_sql_op only ever come from the two case whitelists above, never directly from the caller's field/op text, and every user-supplied value is passed through %L, which format() escapes as a properly quoted literal. Called security invoker, so it only ever returns contacts the calling user could already see under §6.4's RLS.

### 7.5 Account setup: seed_default_contact_statuses

```
create or replace function seed_default_contact_statuses()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  defaults text[] := array[
    'Suspect', 'Prospect', 'Market Qualified Contact', 'Contacted', 'Engaged',
    'Appointment Scheduled', 'Discovery Completed', 'Opportunity Created',
    'Proposal Delivered', 'Negotiation', 'Client Won', 'Lost', 'Ghosted', 'Nurture'
  ];
  status_name text;
  i integer := 0;
begin
  foreach status_name in array defaults loop
    insert into public.contact_statuses (account_id, name, sort_order, is_default)
    values (new.id, status_name, i, true);
    i := i + 1;
  end loop;
  return new;
end;
$$;

create trigger trg_seed_default_contact_statuses
  after insert on accounts
  for each row execute function seed_default_contact_statuses();
```

The fourteen defaults are the literal list from the Developer Brief §16.2. MSPs can rename, reorder, or add to these afterward (PRD §6.2); this trigger only seeds them once, at account creation.

### 7.6 Campaign tracking: record_campaign_event, send_due_campaigns

```
create or replace function record_campaign_event(
  p_tracking_token uuid,
  p_event_type campaign_event_type,
  p_metadata jsonb default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_recipient_id uuid;
begin
  select id into v_recipient_id from campaign_recipients where tracking_token = p_tracking_token;
  if v_recipient_id is null then
    return; -- unknown/expired token: no-op rather than error, since callers are email clients/browsers
  end if;

  insert into campaign_events (campaign_recipient_id, event_type, metadata)
  values (v_recipient_id, p_event_type, p_metadata);

  update campaign_recipients set
    status = case
      when p_event_type = 'bounced' then 'bounced'
      when p_event_type = 'unsubscribed' then 'unsubscribed'
      when p_event_type in ('sent', 'delivered') and status = 'pending' then 'sent'
      else status
    end,
    sent_at = case when p_event_type = 'sent' and sent_at is null then now() else sent_at end,
    first_opened_at = case when p_event_type = 'opened' and first_opened_at is null then now() else first_opened_at end,
    first_clicked_at = case when p_event_type = 'clicked' and first_clicked_at is null then now() else first_clicked_at end,
    bounced_at = case when p_event_type = 'bounced' and bounced_at is null then now() else bounced_at end,
    unsubscribed_at = case when p_event_type = 'unsubscribed' and unsubscribed_at is null then now() else unsubscribed_at end,
    open_count = open_count + case when p_event_type = 'opened' then 1 else 0 end,
    click_count = click_count + case when p_event_type = 'clicked' then 1 else 0 end,
    updated_at = now()
  where id = v_recipient_id;

  if p_event_type = 'unsubscribed' then
    update contacts set email_opt_out = true
      where id = (select contact_id from campaign_recipients where id = v_recipient_id);
  end if;
end;
$$;

create or replace function send_due_campaigns()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign record;
  v_app_url text := current_setting('app.settings.app_url', true);
  v_cron_secret text := current_setting('app.settings.cron_secret', true);
begin
  for v_campaign in
    select id from campaigns
    where status = 'scheduled' and scheduled_at <= now()
    for update skip locked
  loop
    update campaigns set status = 'sending' where id = v_campaign.id;

    perform net.http_post(
      url := v_app_url || '/api/campaigns/send-due',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
      body := jsonb_build_object('campaign_id', v_campaign.id)
    );
  end loop;
end;
$$;
```

send_due_campaigns() only flips a campaign's status and makes one HTTP handoff — it never talks to SMTP itself. §8 covers the rest of that flow, including the one-time ALTER DATABASE setup app.settings.app_url and app.settings.cron_secret need.

## 8. Scheduled Campaign Sending Flow

Postgres cannot send SMTP email itself, so scheduled sending is a two-stage handoff: pg_cron triggers a database function on a fixed schedule, and that function hands the real work to Next.js over HTTP via pg_net.
- A Marketing/Owner/Admin user builds a campaign against a list and either sends immediately or sets scheduled_at and leaves status = 'scheduled'.
- Once a minute, pg_cron calls send_due_campaigns() (§7.6).
- That function finds every campaign with status = 'scheduled' and scheduled_at <= now(), flips each to status = 'sending' (so a second cron tick can't double-send it — for update skip locked also guards against overlap if a run takes longer than a minute), and calls POST /api/campaigns/send-due once per campaign via net.http_post, passing the campaign id and a shared secret header.
- POST /api/campaigns/send-due (§10) resolves the list's members, excludes any contacts.email_opt_out = true, creates a campaign_recipients row per remaining contact (if not already present), and sends each email through Nodemailer over the SendGrid SMTP relay from the campaign's send_from_connection_id mailbox.
- As SendGrid accepts each send, the route calls record_campaign_event() (§7.6) with event_type = 'sent' for that recipient's tracking_token.
- Once every recipient has been processed, the route sets the campaign's status = 'sent' and sent_at = now() (or 'failed' if sending could not complete, so it doesn't get silently retried by the next cron tick).
**One-time setup this flow depends on**, to be run once against the Supabase database after provisioning:
```
alter database postgres set app.settings.app_url = 'https://<production-domain>';
alter database postgres set app.settings.cron_secret = '<same value as the CRON_SECRET env var>';

select cron.schedule(
  'send-due-campaigns',
  '* * * * *',  -- every minute
  $$ select send_due_campaigns(); $$
);
```

POST /api/campaigns/send-due must reject any request whose x-cron-secret header doesn't match CRON_SECRET — without that check, the route would be a public, unauthenticated way to trigger mass email sends.

## 9. Email Open/Click Tracking Flow

Every recipient of a campaign gets a unique campaign_recipients.tracking_token (§5.6), embedded into that recipient's copy of the email at send time — as a 1×1 tracking pixel URL for opens, and as the redirect target for every link for clicks. Both endpoints are public (no Supabase session — the token itself is the credential) and call record_campaign_event() under the service role.
- **Open:** the email client loads GET /api/track/open/[token].gif. The route calls record_campaign_event(token, 'opened') and returns a static 1×1 transparent GIF regardless of whether the token matched anything (never error back to an email client).
- **Click:** every link in the campaign body is rewritten at send time to GET /api/track/click/[token]?url=<original-destination>. The route calls record_campaign_event(token, 'clicked', jsonb_build_object('url', <original-destination>)) and 302-redirects the browser to the original URL.
- **Unsubscribe:** the CAN-SPAM-required footer link points to GET /api/unsubscribe/[token]. The route calls record_campaign_event(token, 'unsubscribed') — which also sets that contact's email_opt_out = true (§7.6) — and shows a plain confirmation page. Every future campaign send excludes opted-out contacts at the list-resolution step (§8, step 4).
- **Bounces & complaints:** these can't be detected from a pixel or redirect — they come from SendGrid's own Event Webhook, delivered to POST /api/webhooks/sendgrid (§10), which verifies SendGrid's signature and calls record_campaign_event() with 'bounced' or 'complained' for the matching token.
record_campaign_event() centralizes all four sources so campaign_events stays a single, consistent append-only log and campaign_recipients's rolled-up counters never fall out of sync with it.

## 10. API Endpoints

Only operations that need a secret, cross-user privilege, or multi-step server logic get a route — everything else is direct browser-to-Supabase under RLS (§11). Every route below uses the Supabase **service role** key server-side unless noted otherwise.
| **Method & Path** | **Auth** | **Purpose** |
| --- | --- | --- |
| POST /api/users/invite | Session (Owner/Admin/CRO Admin) | Calls auth.admin.inviteUserByEmail() with account_id/role metadata (§3) |
| POST /api/users/[id]/deactivate | Session (Owner/Admin/CRO Admin) | Sets archived_at and revokes the target user's active sessions via the Auth Admin API |
| POST /api/accounts | Session (CRO Admin only) | Creates a new MSP accounts row and invites its initial Owner in one multi-step call |
| GET /api/oauth/[provider]/start | Session | Redirects to Microsoft/Google OAuth consent for a mailbox connection |
| GET /api/oauth/[provider]/callback | Session (OAuth redirect) | Exchanges the auth code for tokens, encrypts them (§5.2), and upserts an email_connections row |
| POST /api/import/validate | Session (edit role for contacts) | Parses an uploaded CSV/XLSX (papaparse/ExcelJS), maps columns, returns a preview and error report — no writes yet |
| POST /api/import/commit | Session (edit role for contacts) | Inserts validated rows, calling match_or_create_company() (§7.3) per row and honoring the contacts dedup index (§5.3) |
| POST /api/campaigns/[id]/send | Session (edit role for campaigns) | Validates a campaign and transitions it to scheduled (or immediately to sending) |
| POST /api/campaigns/send-due | x-cron-secret header (no user session) | Called only by send_due_campaigns() (§8); resolves recipients and sends via Nodemailer/SendGrid |
| GET /api/track/open/[token].gif | None (public) | Records an 'opened' event (§9), returns a 1×1 GIF |
| GET /api/track/click/[token] | None (public) | Records a 'clicked' event (§9), 302-redirects to the destination URL |
| GET /api/unsubscribe/[token] | None (public) | Records an 'unsubscribed' event, sets email_opt_out (§9) |
| POST /api/webhooks/sendgrid | SendGrid signature header (no user session) | Records 'bounced' / 'complained' / 'delivered' events from SendGrid's Event Webhook |
| GET /api/reports/export | Session | Streams an XLSX/CSV export of report data (ExcelJS) for volumes too large to build client-side |


## 11. Data Access Pattern Summary

| **Operation** | **Access path** | **Why** |
| --- | --- | --- |
| Reading/writing contacts, companies, opportunities, activities, lists, list membership, contact statuses | Direct browser → Supabase, RLS-protected | Simple CRUD; no secret or multi-step logic involved (§6) |
| Reading campaigns, campaign recipients, campaign events | Direct browser → Supabase, RLS-protected | Read-only for clients either way (§6.6) |
| Creating/editing a campaign in draft | Direct browser → Supabase | Metadata only; sending itself is the privileged step |
| Reading/updating one's own email_connections row (status, disconnect) | Direct browser → Supabase, RLS-protected | Scoped strictly to auth.uid() (§6.3); no secret exposure risk in exposing connection _metadata_ |
| Connecting a mailbox (OAuth), sending a campaign, importing a spreadsheet, inviting/deactivating a user, creating an account, all tracking/webhook endpoints | Next.js API route, service role | Needs an OAuth secret, the SMTP relay credential, the Auth Admin API, or write access that spans RLS-visible rows a single user session shouldn't otherwise have |
| Dashboard/report aggregates | Direct browser → Supabase (aggregate queries under RLS) for Phase 1's single reporting view; GET /api/reports/export only for the file-export path | PRD §6.7 requires no role-specific dashboards and in-app reporting only — no reason to route simple aggregate reads through a server function |


## 12. Assumptions & Open Items

Judgment calls made while turning the PRD, App Flow Document, and prior Q&A into a concrete schema — each is either a mechanical necessity or an interpretation worth the client confirming before Claude Code builds against it.
- **View vs. edit interpretation (§2).** The PRD's role table gives one combined description per role rather than separate view/edit columns. This document reads "view" as broad (any role with account access can see all of that account's CRM data) and "edit" as the PRD's literal per-role list. If the client intended narrower viewing rights per role, only the _select policies in §6 need to change — nothing else in the schema depends on this assumption.
- **email_opt_out**** on ****contacts**** (§5.3)** wasn't listed as a PRD field. It's required to make unsubscribe (§9) and CAN-SPAM compliance (PRD §6.6) actually work, so it's added here as a mechanical necessity rather than a scope addition.
- **get_users_with_last_login()**** instead of a stored ****last_login_at**** column (§3, §7.2)** — reads auth.users.last_sign_in_at live instead of duplicating it, since Supabase already maintains that value and a copy would just be one more place for it to drift out of sync.
- **Smart list criteria schema (§7.4)** is this document's own design — the PRD and App Flow Document call for "criteria-based" list population (PRD §6.3) but don't specify a structure. The seven whitelisted fields cover what the App Flow Document's contact/opportunity screens actually expose as filters; extending the whitelist later only means adding a case branch in compute_smart_list_members(), not a schema change.
- **merge_companies()**** (§7.3)** is a minimal reassign-and-archive implementation of "manual merge otherwise" — it doesn't attempt to reconcile conflicting field values between the two company records (name, industry, etc.); the surviving record simply keeps its own values. A more opinionated merge UI can layer on top of this function without changing it.
- **No audit log table.** PRD §6.9 explicitly limits Phase 1 to a last-login timestamp, with no full audit trail — confirmed out of scope, not an oversight.
- **No file attachments table, no custom fields/pipelines, no client portal tables.** All three were explicitly confirmed out of scope for Phase 1 in this document's clarifying questions and the PRD itself (PRD §6.8, §10) — none of the tables above make any provision for them, so adding any later is a genuine schema change, not a toggle. **Client-confirmed exception:** two Supabase Storage buckets (`company-logos`, `avatars`) were added for the company logo and user profile picture specifically — no new Postgres table, and no general-purpose attachments feature; each just backs a single image field (`accounts.logo_url`, `users.avatar_url`) that already existed or was added for this purpose.
- **New environment variables beyond the Tech Stack Lockfile's §7 checklist:**
| **Variable** | **Purpose** |
| --- | --- |
| TOKEN_ENCRYPTION_KEY | AES-256-GCM key for encrypting OAuth tokens before they're written to email_connections (§5.2) |
| CRON_SECRET | Shared secret checked by POST /api/campaigns/send-due (§8) against the database's app.settings.cron_secret |
| SENDGRID_WEBHOOK_VERIFICATION_KEY | Verifies the signature on incoming SendGrid Event Webhook calls (§10) |

- **pg_cron**** and ****pg_net**** must be enabled from the Supabase dashboard** before running §5's migration — noted in §1, repeated here because it's an easy first-deploy failure point (the extension can be allow-listed per project tier rather than available by default).
- **Opportunity ****name**** is nullable (§5.5).** Neither the PRD nor the App Flow Document names a distinct opportunity title field — the Kanban card shows contact, company, and value. A nullable free-text name is included so the UI can let a user optionally label an opportunity without requiring it.
