-- Client-confirmed: a third exception to Backend Schema §12's "no
-- general-purpose attachments feature" line, alongside the company
-- logo and user avatar buckets already added — a Contact Detail
-- redesign added a profile picture per contact. Same shape as those:
-- one image field backing one bucket, not a general attachments
-- feature. Objects are namespaced by account_id (the same scoping
-- company-logos uses) so RLS can check it without a per-object lookup
-- against the contacts table; the same roles that can edit a contact
-- (CAN_EDIT_ROLES in the Contacts UI) can upload its avatar.
alter table contacts add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-avatars',
  'contact-avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

create policy contact_avatars_select on storage.objects for select
  using (bucket_id = 'contact-avatars');

create policy contact_avatars_insert on storage.objects for insert
  with check (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );

create policy contact_avatars_update on storage.objects for update
  using (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );

create policy contact_avatars_delete on storage.objects for delete
  using (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = public.auth_account_id()::text
    and public.auth_has_any_role('msp_owner', 'msp_admin', 'msp_sales', 'msp_marketing', 'cro_admin', 'cro_advisor')
  );
