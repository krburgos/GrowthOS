-- Backend Schema Document §5.3 — companies, contact_statuses, contacts

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
