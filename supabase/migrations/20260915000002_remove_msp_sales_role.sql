-- Client-confirmed (2026-09-15): the msp_sales role is removed from the
-- product. The one existing user with this role was reassigned to
-- msp_marketing before this migration ran. msp_marketing gets full
-- edit access everywhere except Reports (no edit concept exists there
-- anyway) and Settings (unchanged, still disabled -- gated in the app
-- layer via SIDEBAR_ACCESS, not RLS).
--
-- 'msp_sales' itself is left in the user_role enum rather than dropped
-- -- Postgres has no direct "remove enum value" operation, and
-- recreating the type would mean touching every policy/column that
-- references user_role for no real benefit, since nothing in the app
-- can assign this value anymore once the code-side role lists are
-- updated alongside this migration. It's an inert, unreachable label
-- from here on, not a live role.

update users set role = 'msp_marketing' where role = 'msp_sales';

drop policy companies_insert on companies;
create policy companies_insert on companies for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy companies_update on companies;
create policy companies_update on companies for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy contacts_insert on contacts;
create policy contacts_insert on contacts for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy contacts_update on contacts;
create policy contacts_update on contacts for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy opportunities_insert on opportunities;
create policy opportunities_insert on opportunities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy opportunities_update on opportunities;
create policy opportunities_update on opportunities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy activities_insert on activities;
create policy activities_insert on activities for insert
  with check (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy activities_update on activities;
create policy activities_update on activities for update
  using (
    (account_id = auth_account_id() and auth_has_any_role('msp_owner','msp_admin','msp_marketing'))
    or auth_has_any_role('cro_admin','cro_advisor')
    or is_partner_for(account_id)
  );

drop policy contact_avatars_insert on storage.objects;
create policy contact_avatars_insert on storage.objects for insert
  with check (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );

drop policy contact_avatars_update on storage.objects;
create policy contact_avatars_update on storage.objects for update
  using (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );

drop policy contact_avatars_delete on storage.objects;
create policy contact_avatars_delete on storage.objects for delete
  using (
    bucket_id = 'contact-avatars'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );

drop policy crm_company_logos_insert on storage.objects;
create policy crm_company_logos_insert on storage.objects for insert
  with check (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );

drop policy crm_company_logos_update on storage.objects;
create policy crm_company_logos_update on storage.objects for update
  using (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );

drop policy crm_company_logos_delete on storage.objects;
create policy crm_company_logos_delete on storage.objects for delete
  using (
    bucket_id = 'crm-company-logos'
    and (storage.foldername(name))[1] = auth_account_id()::text
    and auth_has_any_role('msp_owner','msp_admin','msp_marketing','cro_admin','cro_advisor')
  );
