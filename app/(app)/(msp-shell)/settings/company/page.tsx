import type { Metadata } from "next";

import { CompanyLogoUpload } from "@/components/settings/company-logo-upload";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { ProfileHeader } from "@/components/settings/profile-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company Profile — GrowthOS" };

/**
 * Client-confirmed gap-fill — Backend Schema §2 already grants Owner/
 * Admin (own account) and CRO Admin/Advisor (any account) edit rights on
 * "Accounts (own account settings)"; every other in-account role can
 * view, matching that same permission row. accounts_update RLS (Backend
 * Schema §6.1) already enforces this exactly, no new policy needed.
 */
export default async function CompanyProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, website, linkedin_url, logo_url, address_city, address_state")
    .eq("id", user.account_id)
    .single();

  if (!account) return null;

  return (
    <main className="w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <ProfileHeader
        title={account.name}
        subtitle={[account.address_city, account.address_state].filter(Boolean).join(", ") || undefined}
        avatar={<CompanyLogoUpload accountId={account.id} logoUrl={account.logo_url} canEdit={canEdit} />}
      />
      <CompanyProfileForm
        accountId={account.id}
        canEdit={canEdit}
        defaults={{
          name: account.name,
          website: account.website ?? "",
          linkedin_url: account.linkedin_url ?? "",
          address_city: account.address_city ?? "",
          address_state: account.address_state ?? "",
        }}
      />
    </main>
  );
}
