-- GrowthOS Vision Board (client-confirmed addition, 2026-09-16).
-- Same shape and RLS as growth_questionnaire_responses (Backend Schema
-- §6.6a): one row per account, answers in a single jsonb column keyed
-- by the field keys in lib/vision-board/sections.ts.

create table vision_board_responses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references accounts(id),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vision_board_responses_account_id_idx on vision_board_responses(account_id);

alter table vision_board_responses enable row level security;

create policy vision_board_responses_select on vision_board_responses for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));

create policy vision_board_responses_insert on vision_board_responses for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create policy vision_board_responses_update on vision_board_responses for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

create trigger trg_vision_board_responses_updated_at before update on vision_board_responses
  for each row execute function set_updated_at();
