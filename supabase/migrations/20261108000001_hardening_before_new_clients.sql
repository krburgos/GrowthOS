-- Hardening before onboarding more clients (2026-11-08).
--
-- Fixes the findings Supabase's security and performance advisors raised on
-- 2026-11-08. Nothing here changes who can see or do what in the app:
--
--   1. Functions callable without signing in. Supabase grants EXECUTE on
--      every public function to `anon`, so 26 SECURITY DEFINER functions were
--      callable through /rest/v1/rpc with only the public key. Most check the
--      caller inside, but the seed functions, send_due_campaigns and
--      snapshot_closed_quarters (which skips its check when auth.uid() is
--      null) did not. Signed-out visitors lose EXECUTE on all of them.
--      Functions only triggers or pg_cron call lose it for signed-in users
--      too: trigger firing and cron jobs never check the caller's EXECUTE.
--      The service role keeps EXECUTE everywhere (tracking, unsubscribe and
--      the Resend webhook call record_campaign_event with it).
--      The small auth_* / is_* / can_work_account helpers stay as they are:
--      RLS policies call them, and they only ever describe the caller.
--   2. A fixed search_path on five older functions.
--   3. Indexes for the lookups that grow with clients: calls by SDR (Call
--      Logs, the Call Desk scoreboard, the Call Report PDF), opportunities by
--      stage and by owner, list assignments and roster rows by user, campaign
--      recipients and scrub entries by contact.
--   4. Six RLS policies call auth.uid() once per row; wrapped in a scalar
--      sub-select it runs once per query. Same conditions, word for word.
--      email_connections keeps its exact rules (CLAUDE.md, Backend Schema
--      §6.3): this only changes how often auth.uid() is evaluated.
--
-- No new tables, so no new GRANTs to authenticated are needed.

-- ---- 1. EXECUTE ------------------------------------------------------------

-- Called by the app as a signed-in user: keep authenticated, drop anon.
do $$
declare f text;
begin
  foreach f in array array[
    'public.archive_opportunities(uuid[])',
    'public.archive_opportunity(uuid)',
    'public.get_users_with_last_login(uuid)',
    'public.mark_bad_number(uuid, text)',
    'public.resolve_scrub(uuid, boolean)',
    'public.record_email_template_use(uuid)',
    'public.roster_login_candidates(uuid)',
    'public.sdr_candidates(uuid)',
    'public.snapshot_closed_quarters(uuid)',
    'public.record_campaign_event(uuid, public.campaign_event_type, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Only triggers or pg_cron call these: nobody calls them through the API.
do $$
declare f text;
begin
  foreach f in array array[
    'public.send_due_campaigns()',
    'public.seed_default_email_templates(uuid)',
    'public.seed_default_opportunity_stages(uuid)',
    'public.default_opportunity_stage()',
    'public.guard_account_team_member_login()',
    'public.handle_new_user()',
    'public.seed_default_contact_statuses()',
    'public.sync_task_achieved_hours()',
    'public.sync_user_email()',
    'public.trg_seed_default_email_templates_fn()',
    'public.trg_seed_default_opportunity_stages_fn()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---- 2. search_path --------------------------------------------------------

alter function public.set_updated_at() set search_path = public;
alter function public.prevent_self_role_escalation() set search_path = public;
alter function public.normalize_company_domain() set search_path = public;
alter function public.merge_companies(uuid, uuid) set search_path = public;
alter function public.sync_opportunity_company() set search_path = public;

-- ---- 3. Indexes ------------------------------------------------------------

create index if not exists activities_calls_by_sdr_idx
  on public.activities (account_id, user_id, occurred_at desc)
  where type = 'call' and archived_at is null;
create index if not exists opportunities_stage_id_idx on public.opportunities (stage_id);
create index if not exists opportunities_owner_id_idx on public.opportunities (owner_id);
create index if not exists sdr_list_assignments_sdr_user_id_idx on public.sdr_list_assignments (sdr_user_id);
create index if not exists account_team_members_user_id_idx on public.account_team_members (user_id);
create index if not exists campaign_recipients_contact_id_idx on public.campaign_recipients (contact_id);
create index if not exists scrub_entries_contact_id_idx on public.scrub_entries (contact_id);

-- ---- 4. RLS: auth.uid() once per query -------------------------------------

alter policy users_update on public.users
  using ((id = (select auth.uid()))
    or ((account_id = auth_account_id()) and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin'));

alter policy email_connections_insert on public.email_connections
  with check (user_id = (select auth.uid()));

alter policy email_connections_select on public.email_connections
  using ((user_id = (select auth.uid()))
    or exists (select 1 from public.users u where u.id = email_connections.user_id and u.account_id = auth_account_id()));

alter policy email_connections_update on public.email_connections
  using (user_id = (select auth.uid()));

alter policy partner_account_grants_select on public.partner_account_grants
  using ((partner_user_id = (select auth.uid())) or auth_has_any_role('cro_admin'));

alter policy icp_approvals_insert on public.icp_approvals
  with check ((approved_by = (select auth.uid()))
    and (((approver_role = 'msp_owner') and (account_id = auth_account_id()) and auth_has_any_role('msp_owner'))
      or ((approver_role = 'cro_admin') and auth_has_any_role('cro_admin'))));
