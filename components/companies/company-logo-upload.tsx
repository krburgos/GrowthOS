import { ImageUploadCircle } from "@/components/settings/image-upload-circle";

/**
 * companies.logo_url — client-confirmed, Company Detail redesign
 * (Concept B). Same shape as the contact avatar upload: the
 * `crm-company-logos` bucket namespaces objects by account_id first
 * (see the crm_company_logo_storage migration), deliberately separate
 * from the `company-logos` bucket that backs the MSP's own
 * accounts.logo_url, so a prospect company's logo is never confused
 * with the MSP's own branding.
 */
export function CompanyLogoUpload({
  companyId,
  accountId,
  logoUrl,
  canEdit,
  initials,
}: {
  companyId: string;
  accountId: string;
  logoUrl: string | null;
  canEdit: boolean;
  initials: string;
}) {
  return (
    <ImageUploadCircle
      bucket="crm-company-logos"
      folder={`${accountId}/${companyId}`}
      table="companies"
      idColumn="id"
      idValue={companyId}
      urlColumn="logo_url"
      currentUrl={logoUrl}
      canEdit={canEdit}
      ariaLabel="Upload company logo"
      fallback={<span className="text-h2 font-semibold text-white">{initials}</span>}
    />
  );
}
