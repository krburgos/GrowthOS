-- Client-confirmed (2026-10-26, approved mockup "CRM Side Panels", section 4):
-- opportunities can now be deleted, reversing PRD §6.4's "retained
-- permanently". Delete archives (archived_at), the same soft delete every
-- other table uses, so a mistake can be restored from the SQL Editor.
--
-- * Archived opportunities disappear everywhere through RLS: the select
--   policy only shows rows with archived_at null, so the board, lists,
--   Contact/Company Detail, Reports, Headquarters and the KPI counts (a
--   security invoker function) all leave them out with no query changes.
-- * Archiving goes through archive_opportunity(), never a plain update: a
--   row the caller can't see afterwards can't be written by an ordinary
--   update under RLS, and the function enforces the two rules —
--   only Owner, Admin or CRO Admin, and never a Won opportunity.
-- * Every opportunity now has a name (same day): the one unnamed row takes
--   its company's name (else its contact's), and name is required.

alter table opportunities add column archived_at timestamptz;

drop policy opportunities_select on opportunities;
create policy opportunities_select on opportunities for select
  using (
    archived_at is null
    and (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id))
  );

create or replace function archive_opportunity(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_stage_group opportunity_stage_group;
begin
  select o.account_id, s.stage_group into v_account_id, v_stage_group
  from opportunities o
  left join opportunity_stages s on s.id = o.stage_id
  where o.id = p_opportunity_id and o.archived_at is null;

  if v_account_id is null then
    raise exception 'That opportunity couldn''t be found.';
  end if;
  if not (
    (v_account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
    or auth_has_any_role('cro_admin')
  ) then
    raise exception 'Only an Owner, Admin or CRO Admin can delete an opportunity.' using errcode = '42501';
  end if;
  if v_stage_group = 'won' then
    raise exception 'Won opportunities can''t be deleted.';
  end if;

  update opportunities set archived_at = now() where id = p_opportunity_id;
end;
$$;

revoke execute on function archive_opportunity(uuid) from public, anon;
grant execute on function archive_opportunity(uuid) to authenticated, service_role;

update opportunities o
set name = coalesce(
  (select c.name from companies c where c.id = o.company_id),
  (select ct.full_name from contacts ct where ct.id = o.contact_id),
  'Untitled opportunity'
)
where o.name is null or btrim(o.name) = '';

alter table opportunities alter column name set not null;
alter table opportunities add constraint opportunities_name_not_blank check (btrim(name) <> '');
