import { Building2 } from "lucide-react";

import { ImageUploadCircle } from "@/components/settings/image-upload-circle";

/**
 * Client-confirmed reversal of the earlier "logo is a pasted URL, not a
 * file upload" decision — Backend Schema §12 keeps file attachments out
 * of Phase 1 scope generally, but this is a direct, explicit request to
 * reopen that line for the company logo specifically. Writes to
 * accounts.logo_url via the shared ImageUploadCircle (company-logos
 * bucket, public read, write restricted to Owner/Admin/CRO Admin/CRO
 * Advisor for their own account — see the company_logo_storage
 * migration).
 */
export function CompanyLogoUpload({
  accountId,
  logoUrl,
  canEdit,
}: {
  accountId: string;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  return (
    <ImageUploadCircle
      bucket="company-logos"
      folder={accountId}
      table="accounts"
      idColumn="id"
      idValue={accountId}
      urlColumn="logo_url"
      currentUrl={logoUrl}
      canEdit={canEdit}
      ariaLabel="Upload company logo"
      fallback={<Building2 className="size-1/2 text-neutral-400" />}
    />
  );
}
