-- Client-confirmed: a fourth exception to Backend Schema §12's "no
-- general-purpose attachments feature" line, alongside the MSP's own
-- company logo, user avatar, and contact avatar buckets already added
-- -- the Company Detail redesign (Concept B) adds an uploadable logo
-- per CRM company record. Deliberately a separate bucket from
-- 'company-logos' (which backs accounts.logo_url, the MSP's own
-- branding), to avoid ever mixing the MSP's identity with a prospect
-- company's. Objects are namespaced by account_id first (matching
-- contact-avatars' pattern) so RLS can check it without a per-object
-- lookup against the companies table; same edit roles as the
-- companies table itself (Companies page EDIT_ROLES).
alter table companies add column logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-company-logos',
  'crm-company-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

create policy crm_company_logos_select on storage.objects for select
  using (bucket_id = 'crm-company-logos');

create policy crm_company_logos_insert on storage.objects for insert
  with check (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );

create policy crm_company_logos_update on storage.objects for update
  using (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );

create policy crm_company_logos_delete on storage.objects for delete
  using (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );
