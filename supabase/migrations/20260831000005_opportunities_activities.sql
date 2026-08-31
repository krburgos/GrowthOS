-- Backend Schema Document §5.5 — opportunities, activities

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
