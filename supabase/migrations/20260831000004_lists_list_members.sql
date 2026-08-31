-- Backend Schema Document §5.4 — lists, list_members

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
