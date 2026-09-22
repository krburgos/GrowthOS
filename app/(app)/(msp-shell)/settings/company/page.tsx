import type { Metadata } from "next";

import { CompanyLogoUpload } from "@/components/settings/company-logo-upload";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { COMPANY_PROFILE_COLUMNS, formatAddress, type CompanyProfile } from "@/lib/accounts/company-profile";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company Profile — GrowthOS" };

/**
 * Client-confirmed gap-fill — Backend Schema §2 already grants Owner/
 * Admin (own account) and CRO Admin/Advisor (any account) edit rights on
 * "Accounts (own account settings)"; every other in-account role can
 * view, matching that same permission row. accounts_update RLS (Backend
 * Schema §6.1) already enforces this exactly, no new policy needed.
 *
 * Client-confirmed redesign (2026-09-22, approved mockup "B"): the tall
 * gradient-with-a-radial-glow banner - which existed only here and on My
 * Profile - gives way to a plain identity card, and the page is capped at
 * 900px so a short value sits near its label rather than floating in a line
 * the full width of a 1440px page. The logo is still uploaded from this
 * header, not edited as a field in the form.
 */
export default async function CompanyProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const { data: account } = (await supabase
    .from("accounts")
    .select(COMPANY_PROFILE_COLUMNS)
    .eq("id", user.account_id)
    .single()) as { data: CompanyProfile | null };

  if (!account) return null;

  const address = formatAddress(account);

  return (
    <main className="w-full max-w-[900px] flex-1 p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-neutral-200 bg-white px-5 py-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg">
          <CompanyLogoUpload accountId={account.id} logoUrl={account.logo_url} canEdit={canEdit} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-neutral-400">Company profile</p>
          <h1 className="truncate text-h3 text-primary-900">{account.name}</h1>
          {address && <p className="truncate text-body-sm text-neutral-500">{address}</p>}
        </div>
      </div>

      <CompanyProfileForm
        accountId={account.id}
        canEdit={canEdit}
        defaults={{
          name: account.name,
          website: account.website ?? "",
          linkedin_url: account.linkedin_url ?? "",
          phone: account.phone ?? "",
          ceo_name: account.ceo_name ?? "",
          address_street: account.address_street ?? "",
          address_suite: account.address_suite ?? "",
          address_city: account.address_city ?? "",
          address_state: account.address_state ?? "",
          address_zip: account.address_zip ?? "",
          sales_marketing_names: account.sales_marketing_names ?? [],
        }}
      />
    </main>
  );
}
