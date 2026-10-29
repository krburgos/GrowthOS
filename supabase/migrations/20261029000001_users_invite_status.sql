-- Client-confirmed (2026-10-29, approved mockup "Resend Invite"): the user
-- lists show "Invited" for someone who never accepted their invite, and
-- offer Resend invite once that invite's link has expired. Both need when
-- the invite was sent and whether it was accepted, which live in auth.users
-- beside last_sign_in_at, so get_users_with_last_login returns them too.
-- Same caller rules as before. The return type changes, so it is dropped
-- and recreated rather than replaced.
--
-- invite_sent_at is the later of invited_at and confirmation_sent_at, so a
-- resent invite counts from when it was resent.

drop function if exists get_users_with_last_login(uuid);

create function get_users_with_last_login(p_account_id uuid default null)
returns table(user_id uuid, last_sign_in_at timestamptz, invite_sent_at timestamptz, email_confirmed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if p_account_id is not null and p_account_id != auth_account_id() and not is_cro_leader() then
    raise exception 'Not authorized to view this account''s users.';
  end if;
  return query
    select u.id, au.last_sign_in_at, greatest(au.invited_at, au.confirmation_sent_at), au.email_confirmed_at
    from public.users u
    join auth.users au on au.id = u.id
    where (p_account_id is null or u.account_id = p_account_id)
      and (u.account_id = auth_account_id() or is_cro_leader());
end;
$$;

grant execute on function get_users_with_last_login(uuid) to authenticated, service_role;
