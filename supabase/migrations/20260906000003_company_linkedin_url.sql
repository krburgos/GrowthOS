-- Client-confirmed addition: a CRM company record (companies table —
-- e.g. a contact's employer, distinct from accounts.linkedin_url which
-- is the MSP's own Company Profile LinkedIn, added earlier) gets its
-- own LinkedIn page field, same shape as companies.website.
alter table companies add column linkedin_url text;
