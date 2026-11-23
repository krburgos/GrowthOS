-- Client-confirmed (2026-11-23, approved mockup "Invite Sender Column"): the
-- CRO Dashboard's All Users table shows who sent each person's invite and
-- when, kept after they accept. A resend overwrites both with the latest
-- send. This is the latest send per person, not a history (an audit log is
-- out of scope for Phase 1, PRD §10).
--
-- Written only by the invite, create-account and resend-invite API routes
-- (service role). Invites sent before today have no sender; the page falls
-- back to auth.users' invite time for those.
--
-- No foreign key on invited_by: a second users -> users relationship would
-- make bare PostgREST embeds of users ambiguous. Users are never
-- hard-deleted (soft delete everywhere), so the id always resolves.

alter table public.users
  add column if not exists invited_by uuid,
  add column if not exists invited_at timestamptz;

comment on column public.users.invited_by is 'Who sent this person''s latest invite (users.id). Null for invites sent before 2026-11-23.';
comment on column public.users.invited_at is 'When this person''s latest invite was sent.';

-- Only the service-role API routes may write these (security review,
-- 2026-11-23): users can update their own row, and Owners/Admins their
-- account's rows, so without this anyone could rewrite who invited them.
-- The service role (and the SQL Editor) run with no auth.uid().
create or replace function public.protect_invite_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.invited_by is distinct from old.invited_by or new.invited_at is distinct from old.invited_at) then
    raise exception 'Invite details are set by GrowthMission when an invite is sent.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_invite_stamp on public.users;
create trigger trg_protect_invite_stamp
  before update on public.users
  for each row execute function public.protect_invite_stamp();
