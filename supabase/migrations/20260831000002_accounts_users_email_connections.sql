-- Backend Schema Document §5.2 — accounts, users, email_connections

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
