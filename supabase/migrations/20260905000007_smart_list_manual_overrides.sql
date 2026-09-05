-- Client-confirmed deviation from Backend Schema §7.4: smart lists were
-- purely computed ("never stored"), so none of the manual list tools
-- (Add Contacts, Upload Contacts, Move/Copy, Remove) worked on them.
-- The client wants a hybrid — a smart list's members are still driven
-- by its live criteria, but a contact can now also be manually added on
-- top of that (even if they don't match) or manually excluded (even if
-- they do match). Static lists are unaffected: their membership is
-- still exactly their list_members rows, no exclusions concept needed
-- since there's no live criteria to suppress a match from.

-- This trigger existed specifically to block list_members inserts for
-- smart lists — the opposite of what manual overrides need, so it's
-- removed rather than special-cased.
drop trigger if exists trg_enforce_static_list_membership on list_members;
drop function if exists enforce_static_list_membership();

create table list_exclusions (
  list_id uuid not null references lists(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  excluded_at timestamptz not null default now(),
  excluded_by uuid references users(id),
  primary key (list_id, contact_id)
);

alter table list_exclusions enable row level security;

create policy list_exclusions_select on list_exclusions for select
  using (
    exists (
      select 1 from lists l
      where l.id = list_exclusions.list_id
        and (l.account_id = auth_account_id() or is_cro_leader())
    )
  );

create policy list_exclusions_insert on list_exclusions for insert
  with check (
    exists (
      select 1 from lists l
      where l.id = list_exclusions.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin', 'msp_marketing'))
          or auth_has_any_role('cro_admin', 'cro_advisor')
        )
    )
  );

create policy list_exclusions_delete on list_exclusions for delete
  using (
    exists (
      select 1 from lists l
      where l.id = list_exclusions.list_id
        and (
          (l.account_id = auth_account_id() and auth_has_any_role('msp_owner', 'msp_admin', 'msp_marketing'))
          or auth_has_any_role('cro_admin', 'cro_advisor')
        )
    )
  );

-- Same criteria-evaluation logic as before, now unioned with manual
-- list_members additions and minus list_exclusions on both sides.
create or replace function compute_smart_list_members(p_list_id uuid)
returns table(contact_id uuid)
language plpgsql security invoker
as $$
declare
  v_criteria jsonb;
  v_account_id uuid;
  v_match text;
  v_condition jsonb;
  v_field text;
  v_op text;
  v_value text;
  v_sql_field text;
  v_sql_op text;
  v_clause text;
  v_clauses text[] := array[]::text[];
  v_join_word text;
  v_where text;
begin
  select criteria, account_id into v_criteria, v_account_id from lists where id = p_list_id and type = 'smart';
  if v_criteria is null then
    raise exception 'List % is not a smart list or has no criteria', p_list_id;
  end if;

  v_match := coalesce(v_criteria->>'match', 'all');
  v_join_word := case when v_match = 'any' then ' or ' else ' and ' end;

  for v_condition in select * from jsonb_array_elements(v_criteria->'conditions') loop
    v_field := v_condition->>'field';
    v_op := v_condition->>'op';
    v_value := v_condition->>'value';

    v_sql_field := case v_field
      when 'status_id' then 'status_id'
      when 'owner_id' then 'owner_id'
      when 'company_id' then 'company_id'
      when 'source' then 'source::text'
      when 'title' then 'title'
      when 'email' then 'email'
      when 'created_at' then 'created_at'
      else null
    end;
    if v_sql_field is null then
      raise exception 'Smart list condition references an unsupported field: %', v_field;
    end if;

    v_sql_op := case v_op
      when 'eq' then '='
      when 'neq' then '<>'
      when 'contains' then 'ilike'
      when 'before' then '<'
      when 'after' then '>'
      else null
    end;
    if v_sql_op is null then
      raise exception 'Smart list condition uses an unsupported operator: %', v_op;
    end if;

    if v_op = 'contains' then
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, '%' || v_value || '%');
    else
      v_clause := format('%s %s %L', v_sql_field, v_sql_op, v_value);
    end if;

    v_clauses := array_append(v_clauses, v_clause);
  end loop;

  if array_length(v_clauses, 1) is null then
    v_where := 'true';
  else
    v_where := array_to_string(v_clauses, v_join_word);
  end if;

  return query execute format(
    'select c.id from contacts c
       where c.account_id = %L and c.archived_at is null and (%s)
         and c.id not in (select contact_id from list_exclusions where list_id = %L)
     union
     select lm.contact_id from list_members lm
       join contacts c on c.id = lm.contact_id
       where lm.list_id = %L and c.archived_at is null
         and lm.contact_id not in (select contact_id from list_exclusions where list_id = %L)',
    v_account_id, v_where, p_list_id, p_list_id, p_list_id
  );
end;
$$;
