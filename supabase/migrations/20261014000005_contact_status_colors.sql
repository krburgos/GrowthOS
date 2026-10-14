-- Client-confirmed (2026-10-14, approved mockup "Status Colors"): each
-- contact status carries a color, chosen in Settings › Contact Statuses
-- from twelve swatches (Design System §8.3 amendment). The color is a
-- swatch key, never a free hex, so every pill stays a contrast-checked
-- tint that sits quietly in the tables. Backend Schema §5.3 amendment.
--
-- Defaults, as the client set them: MQL orange, MQC yellow, SNIPER green,
-- every other status gray. New accounts' default statuses follow the same
-- rule. Additive: no policy changes, since the column is covered by
-- contact_statuses' existing update policy.

alter table contact_statuses
  add column color text not null default 'gray'
    check (color in ('gray', 'navy', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'gold', 'orange', 'red', 'rose'));

update contact_statuses set color = case lower(trim(name))
  when 'mql' then 'orange'
  when 'mqc' then 'yellow'
  when 'sniper' then 'green'
  else 'gray'
end;

create or replace function seed_default_contact_statuses()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  defaults text[] := array['MQC', 'MQL', 'Scrub', 'Existing Client', 'Not a Fit', 'Internal', 'UnSub - Call Only'];
  colors text[] := array['yellow', 'orange', 'gray', 'gray', 'gray', 'gray', 'gray'];
  i integer;
begin
  for i in 1 .. array_length(defaults, 1) loop
    insert into public.contact_statuses (account_id, name, sort_order, is_default, color)
    values (new.id, defaults[i], i - 1, true, colors[i]);
  end loop;
  return new;
end;
$$;
