-- Client-confirmed (2026-11-02, approved mockup "Welcome Email CC"): CRO
-- Admin can send a welcome email, with a Set your password link, to a
-- client user who has never logged in. All Users shows "Welcome sent <date>"
-- and filters on it, so the last send is kept here. Written only by
-- POST /api/users/[id]/welcome with the service role.
--
-- Run in the SQL Editor before deploying the code that reads it.

alter table users add column welcome_sent_at timestamptz;
