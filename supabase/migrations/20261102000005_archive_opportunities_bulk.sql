-- Client-confirmed (2026-11-02, approved mockup "Opportunity Bulk Actions"):
-- Delete on the Opportunities List's bulk bar. The same rules as
-- archive_opportunity() for one: an Owner or Admin on their own account, or
-- CRO Admin; Won opportunities are never deleted. Here Won ones in the
-- selection are skipped rather than failing the whole set, and the caller is
-- told how many were deleted and how many skipped.
--
-- Run in the SQL Editor before deploying the code that calls it.

create or replace function archive_opportunities(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
  v_won integer;
begin
  if exists (
    select 1 from opportunities o
    where o.id = any(p_ids) and o.archived_at is null
      and not ((o.account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin'))
               or auth_has_any_role('cro_admin'))
  ) then
    raise exception 'Only an Owner, Admin or CRO Admin can delete an opportunity.' using errcode = '42501';
  end if;

  select count(*) into v_won
  from opportunities o join opportunity_stages s on s.id = o.stage_id
  where o.id = any(p_ids) and o.archived_at is null and s.stage_group = 'won';

  update opportunities o set archived_at = now()
  from opportunity_stages s
  where s.id = o.stage_id and o.id = any(p_ids) and o.archived_at is null and s.stage_group <> 'won';
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'skipped_won', v_won);
end;
$$;

grant execute on function archive_opportunities(uuid[]) to authenticated;
