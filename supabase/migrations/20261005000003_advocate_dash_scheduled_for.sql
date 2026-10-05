-- AdvocateDash: when a drop-by is booked for (client-confirmed, 2026-10-05).
--
-- Added for the My Visits field screen (App Flow §4.3d). The mockup for
-- that screen showed "3 drop-bys today, routed in order", which the schema
-- could not answer: a target carried only its three states and the date it
-- was *completed*. There was nothing to say when a Scheduled visit was
-- scheduled for, so "today's visits" had no definition.
--
-- One nullable date, deliberately not a timestamp: an Advocate's day is
-- planned by date and route, not to the minute, and the paper form records
-- arrival and departure times inside the report rather than a booked slot.
--
-- No ordering column. Route order within a day is a real idea, but it would
-- need either a sequence the user maintains by hand or geocoded addresses to
-- derive, and the addresses here are free text. My Visits therefore orders a
-- day by the order targets were added, and the "Open next in Maps" action
-- hands one address to Google Maps rather than claiming to plan a route.
alter table advocate_dash_targets
  add column scheduled_for date;

comment on column advocate_dash_targets.scheduled_for is
  'The date this drop-by is booked for. Null until somebody schedules it. '
  'Distinct from completed_on, which is the date it actually happened.';

-- The field screen reads one account's upcoming visits by date, which is
-- the only query shape this column serves.
create index advocate_dash_targets_scheduled_idx
  on advocate_dash_targets(account_id, scheduled_for)
  where archived_at is null;
