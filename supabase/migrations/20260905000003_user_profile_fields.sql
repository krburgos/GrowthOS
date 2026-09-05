-- Client-confirmed gap-fill, same shape as the Company Profile addition
-- (20260905000001) — the users table only ever carried what auth/roles
-- needed; these are standard personal-profile fields the reference
-- CRM's My Profile screen expects, not the "custom fields" concept
-- Backend Schema §12 excludes (that refers to user-defined arbitrary
-- field building, not naming a few specific columns).
alter table users
  add column phone text,
  add column job_title text,
  add column linkedin_url text;
