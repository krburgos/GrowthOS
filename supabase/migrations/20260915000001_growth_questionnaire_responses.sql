-- Client-confirmed (2026-09-15) -- Growth Solution Questionnaire, one row
-- per account. Answers stored as jsonb keyed by a stable question key
-- (lib/questionnaire/questions.ts is the source of truth for the question
-- list itself) rather than one column per question, since the underlying
-- Word doc this was sourced from can change without needing a migration
-- every time. completed_at is set once every question has a non-null
-- answer (app-layer, not a DB constraint -- the set of required keys
-- lives in code, not the schema).
create table growth_questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references accounts(id),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index growth_questionnaire_responses_account_id_idx on growth_questionnaire_responses(account_id);

alter table growth_questionnaire_responses enable row level security;

-- Same shape as contact_statuses (Backend Schema §6.4): account-scoped,
-- Owner/Admin write, CRO Admin/Advisor and a granted partner get the same
-- read+write parity they have on every other tenant table.
create policy growth_questionnaire_responses_select on growth_questionnaire_responses for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy growth_questionnaire_responses_insert on growth_questionnaire_responses for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy growth_questionnaire_responses_update on growth_questionnaire_responses for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create trigger trg_growth_questionnaire_responses_updated_at before update on growth_questionnaire_responses
  for each row execute function set_updated_at();
