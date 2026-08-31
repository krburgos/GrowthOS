-- Backend Schema Document §5.1 — Extensions & Enums

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
