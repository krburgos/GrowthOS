-- Deviation from Backend Schema Document §7.6/§8: the doc specifies
-- send_due_campaigns() reading app_url/cron_secret via
-- current_setting('app.settings.*'), populated by
-- `alter database postgres set app.settings.* = ...`. That requires
-- Postgres superuser, which Supabase hosted projects never grant — not
-- via the Management API, not via the Dashboard SQL Editor, not at the
-- database or role level (confirmed by direct 42501 permission-denied
-- errors on all four combinations). Confirmed with the client: use
-- Supabase Vault instead (supabase_vault, already installed per §5.1) —
-- Supabase's own purpose-built mechanism for exactly this. Everything
-- else in the Backend Schema Document is unaffected; only
-- send_due_campaigns()'s two internal variable lookups change.

-- The two vault.create_secret() calls that seed 'app_url' and
-- 'cron_secret' were run directly against the project (not from this
-- file) so the cron_secret value never enters git history — this repo
-- is public. Reference shape, values omitted:
--
--   select vault.create_secret('<app base URL>', 'app_url', '...');
--   select vault.create_secret('<random 32+ byte secret>', 'cron_secret', '...');
--
-- Both were placeholders as of this migration (app_url: the Milestone 1
-- preview URL; cron_secret: generated ad hoc) — update via
-- vault.update_secret() once the real values are known (app_url at
-- Milestone 13 go-live, cron_secret to match the CRON_SECRET Vercel env
-- var set in Milestone 10).

create or replace function send_due_campaigns()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign record;
  v_app_url text;
  v_cron_secret text;
begin
  select decrypted_secret into v_app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'cron_secret';

  for v_campaign in
    select id from campaigns
    where status = 'scheduled' and scheduled_at <= now()
    for update skip locked
  loop
    update campaigns set status = 'sending' where id = v_campaign.id;

    perform net.http_post(
      url := v_app_url || '/api/campaigns/send-due',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
      body := jsonb_build_object('campaign_id', v_campaign.id)
    );
  end loop;
end;
$$;
