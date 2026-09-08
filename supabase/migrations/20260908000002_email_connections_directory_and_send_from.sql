-- Client-confirmed addition (2026-09-08) — Contact Detail's quick-send
-- Email button grew a "From" identity picker showing every connected
-- mailbox in the account (not just the sender's own), plus a Cc field.
--
-- email_connections stays single-user for INSERT/UPDATE (connecting or
-- disconnecting your own mailbox is unchanged) and for the two token
-- columns, which remain exactly as private as before via a column-level
-- REVOKE — only the non-secret identity columns become account-visible,
-- via a broadened SELECT row policy. No CRO Leader bypass is added.

drop policy if exists email_connections_select on email_connections;

create policy email_connections_select on email_connections for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from users u
      where u.id = email_connections.user_id
        and u.account_id = auth_account_id()
    )
  );

revoke select on email_connections from authenticated;
grant select (id, user_id, provider, email_address, status, last_synced_at, archived_at, created_at, updated_at)
  on email_connections to authenticated;
-- access_token_encrypted / refresh_token_encrypted are deliberately not
-- granted to `authenticated` — only the service-role client (used
-- server-side in the OAuth callback route) can read them.

alter table activities add column send_from_connection_id uuid references email_connections(id) on delete set null;
alter table activities add column cc text;
-- Both nullable: send_from_connection_id is null when an email used the
-- sender's own identity (the default, unchanged case) rather than a
-- picked teammate's connected mailbox; cc is null when no Cc addresses
-- were entered. Free-text, not validated against contacts (client-
-- confirmed, 2026-09-08) — a semicolon/comma-separated address list.
