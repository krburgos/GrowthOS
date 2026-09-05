-- Client-confirmed reversal: logo_url was originally a pasted link
-- specifically to avoid introducing file storage (Backend Schema §12
-- keeps file attachments out of Phase 1 scope generally). The client
-- has now explicitly asked for a real upload instead — this is a
-- deliberate, direct request to reopen that scope line for this one
-- field, not a silent addition. accounts.logo_url is unchanged (still
-- a text column); it now stores the uploaded file's public URL instead
-- of a manually pasted one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

-- Public bucket: reads bypass RLS via the public URL endpoint, but a
-- select policy is still added for consistency/defense in depth.
create policy company_logos_select on storage.objects for select
  using (bucket_id = 'company-logos');

-- Objects are namespaced by account_id as the first path segment
-- (company-logos/<account_id>/<filename>), so each MSP can only touch
-- its own logo file(s) — same Owner/Admin/CRO Admin/CRO Advisor
-- restriction as the accounts_update policy (Backend Schema §6.1).
create policy company_logos_insert on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'cro_admin', 'cro_advisor')
  );

create policy company_logos_update on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'cro_admin', 'cro_advisor')
  );

create policy company_logos_delete on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'cro_admin', 'cro_advisor')
  );
