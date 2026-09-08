-- Split into its own migration/transaction: Postgres forbids using a
-- newly-added enum value in the same transaction that adds it. See
-- 20260908000004_partner_role_and_account_grants.sql for the rest.
alter type user_role add value 'partner';
