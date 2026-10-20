-- Client-confirmed (2026-10-20, approved mockups "Email Composer Options" B
-- and "Email Templates and Signature"): templates and signatures for
-- Contact Detail's 1-1 email.
--
--   email_templates — shared by the account. Anyone who can email
--   contacts may use one and save one from the email dialog; MSP
--   Owner/Admin and CRO Leader edit or retire them in Settings →
--   Customizations → Email Templates. Soft delete via archived_at.
--   Fill-in fields are stored as text tokens ("{First name}") inside the
--   subject and the HTML, and filled in at send time.
--
--   users.email_signature_html / email_signature_auto — one signature per
--   person, set in Settings → My Profile → Email Signature, added to new
--   emails when auto is on.

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  subject text not null default '',
  body_html text not null default '',
  use_count integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index email_templates_account_idx on email_templates(account_id) where archived_at is null;

create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute function set_updated_at();

alter table email_templates enable row level security;

create policy email_templates_select on email_templates for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

-- The roles that can email contacts may save a template.
create policy email_templates_insert on email_templates for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin', 'msp_marketing'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

-- Editing and retiring is for the people who manage Customizations.
create policy email_templates_update on email_templates for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin', 'cro_advisor')
  );

-- Counting a use is open to anyone who can send, without granting them
-- the right to edit the template itself.
create or replace function record_email_template_use(p_template_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update email_templates
  set use_count = use_count + 1
  where id = p_template_id
    and archived_at is null
    and (account_id = auth_account_id() or is_cro_leader());
$$;

grant execute on function record_email_template_use(uuid) to authenticated;

-- Four starters, editable like any other template.
create or replace function seed_default_email_templates(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into email_templates (account_id, name, subject, body_html) values
    (p_account_id, 'FME follow-up', 'Great meeting you, {First name}',
     '<p>Hi {First name},</p><p>Thanks for making time to meet with us today. As promised, here''s a quick recap of what we discussed for {Company}:</p><ul><li><p>…</p></li></ul><p>Would you have time for a short follow-up next week?</p>'),
    (p_account_id, 'Proposal sent', 'Your proposal for {Company}',
     '<p>Hi {First name},</p><p>Your proposal for {Company} is attached. I''ve kept it to what we discussed, and I''m happy to walk you through it.</p><p>When would be a good time for a quick call?</p>'),
    (p_account_id, 'Checking in', 'Quick check-in',
     '<p>Hi {First name},</p><p>Just checking in to see whether anything has changed on your side, and whether there''s anything I can help with.</p>'),
    (p_account_id, 'No-show reschedule', 'Sorry we missed you, {First name}',
     '<p>Hi {First name},</p><p>Sorry we missed each other today. I know how quickly schedules change.</p><p>Would another time this week or next work better for you?</p>');
end;
$function$;

create or replace function trg_seed_default_email_templates_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform seed_default_email_templates(new.id);
  return new;
end;
$function$;

create trigger trg_seed_default_email_templates
  after insert on accounts
  for each row execute function trg_seed_default_email_templates_fn();

-- Existing accounts get the starters too.
do $$
declare
  acct record;
begin
  for acct in select id from accounts loop
    if not exists (select 1 from email_templates where account_id = acct.id) then
      perform seed_default_email_templates(acct.id);
    end if;
  end loop;
end;
$$;

alter table users
  add column if not exists email_signature_html text,
  add column if not exists email_signature_auto boolean not null default true;
