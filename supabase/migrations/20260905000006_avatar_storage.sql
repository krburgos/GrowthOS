-- Same shape as the company_logo_storage migration — users.avatar_url
-- already existed in the original schema (Backend Schema §5.2) but was
-- never wired to anything. Client-confirmed: make it a real upload,
-- same as the company logo. Every user manages only their own file
-- (path avatars/<user_id>/avatar.<ext>), no role restriction needed
-- since this isn't account-scoped.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

create policy avatars_select on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
