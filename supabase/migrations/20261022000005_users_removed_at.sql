-- Remove a user (client-confirmed, 2026-10-22, approved mockup "CRO
-- Dashboard People" v2). Nothing is hard-deleted (Backend Schema §2), so
-- removing a person is a state, not a delete:
--
--   deactivated  archived_at set, removed_at null — can't sign in, still
--                listed (greyed) with Reactivate;
--   removed      removed_at set (archived_at too) — can't sign in and
--                left off every user list. Their past work keeps their
--                name, since every reference to them stays intact.
--
-- Inviting a removed person's email again restores the same account
-- (POST /api/users/invite). A new column on an existing table needs no
-- new grants.

alter table users add column removed_at timestamptz;
