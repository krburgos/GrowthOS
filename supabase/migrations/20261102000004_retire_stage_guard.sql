-- Client-confirmed (2026-11-02, approved mockup "Retire Stage Guard"): a
-- stage can be retired only once no opportunity is in it, Won and Lost
-- included. The Opportunities board draws columns for live stages only, so
-- an opportunity left in a retired stage would drop off the board. Settings
-- checks first and explains; this is the same rule for every other path.
--
-- Run in the SQL Editor.

create or replace function guard_retire_stage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.archived_at is not null and old.archived_at is null then
    select count(*) into v_count from opportunities where stage_id = old.id and archived_at is null;
    if v_count > 0 then
      raise exception '% % still in %. Move them to another stage first.',
        v_count, case when v_count = 1 then 'opportunity is' else 'opportunities are' end, old.name
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_opportunity_stages_guard_retire before update on opportunity_stages
  for each row execute function guard_retire_stage();
