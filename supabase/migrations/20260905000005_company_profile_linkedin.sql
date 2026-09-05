-- Client-confirmed field swap on Company Profile: Industry -> Company
-- LinkedIn. Only accounts.industry is affected — the separate industry
-- field on the companies table (CRM company records under Contacts) is
-- a different concept entirely and is untouched.
alter table accounts
  add column linkedin_url text,
  drop column industry;
