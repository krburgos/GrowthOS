-- AdvocateDash: a manual visit order (client-confirmed, 2026-10-06).
--
-- The client wants to decide which drop-by comes first. Proximity sorting
-- was the other option considered and is the better long-term answer, but
-- it needs a geocoding provider, which is a Tech Stack Lockfile change and
-- a vendor decision; this is the version that needs neither and ships now.
-- The two compose later: a "Sort by: my order / distance" toggle leaves
-- this column exactly as it is.
--
-- Plain integer rather than a fractional rank. Fractional ranks (0.5
-- between 0 and 1) avoid rewriting neighbours on every move, but they drift
-- toward float precision trouble and need periodic renumbering. A drop-by
-- list is a handful of rows per account, so rewriting the affected ones on
-- each drop is cheaper than the machinery to avoid it.
alter table advocate_dash_targets
  add column sort_order integer not null default 0;

comment on column advocate_dash_targets.sort_order is
  'Manual visit order within an account, lowest first. Ties fall back to '
  'created_at, so a row that has never been moved keeps its insertion order.';

-- Backfill to the order rows were added, so nothing jumps around the first
-- time anybody opens the list. Partitioned by account: the order is each
-- tenant''s own and must not be global.
with ranked as (
  select id, row_number() over (partition by account_id order by created_at) as rn
  from advocate_dash_targets
)
update advocate_dash_targets t
set sort_order = ranked.rn
from ranked
where ranked.id = t.id;

-- The field screen reads one account's targets in this order.
create index advocate_dash_targets_order_idx
  on advocate_dash_targets(account_id, sort_order)
  where archived_at is null;
