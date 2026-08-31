-- Backend Schema Document §5.6 — campaigns, campaign_recipients, campaign_events

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
