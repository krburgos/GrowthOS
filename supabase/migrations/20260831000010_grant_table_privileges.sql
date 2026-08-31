-- Mechanical necessity not covered by the Backend Schema Document: none
-- of §5-§7 include GRANT statements. This project's public schema has
-- restrictive default privileges for objects created by the `postgres`
-- role (which is what the migrations ran as) — anon/authenticated/
-- service_role get TRUNCATE/REFERENCES/TRIGGER only, no SELECT/INSERT/
-- UPDATE/DELETE. Without this, RLS never even gets evaluated — every
-- query fails at the table-grant level first ("permission denied for
-- table X"), for every role including service_role. RLS policies (§6)
-- remain the actual authorization boundary; these are the base grants
-- Supabase's own dashboard-created tables get automatically.

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Apply the same going forward for tables/sequences/functions created by
-- `postgres` in later migrations, so this doesn't recur each milestone.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
