import type { Metadata } from "next";

import { CompanyLogoUpload } from "@/components/settings/company-logo-upload";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { TeamRoster } from "@/components/settings/team-roster";
import {
  COMPANY_PROFILE_COLUMNS,
  COMPLETENESS_FIELDS,
  formatAddress,
  profileCompleteness,
  type CompanyProfile,
} from "@/lib/accounts/company-profile";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { getMemberTaskLoad } from "@/lib/gos-dashboard/queries";
import { getTeamMembers } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Company Profile — GrowthOS" };

/**
 * Client-confirmed gap-fill — Backend Schema §2 already grants Owner/
 * Admin (own account) and CRO Admin/Advisor (any account) edit rights on
 * "Accounts (own account settings)"; every other in-account role can
 * view, matching that same permission row. accounts_update RLS (Backend
 * Schema §6.1) already enforces this exactly, no new policy needed.
 *
 * Client-confirmed redesign (2026-09-25). The page's real subject is *who
 * does what* — the roster maps people onto the fourteen workstreams, which
 * no ordinary settings screen has — so the people section carries the
 * weight at the foot of the page, and the company's own facts sit above it
 * as a quiet two-column record. Three changes came with it:
 *
 * - **Completeness is split in two.** The figure in the identity bar
 *   answers *whether*; the checklist beside the record answers *what*. A
 *   sentence naming the missing fields did not survive six being missing.
 * - **The duplicate Sales & Marketing editor is gone.** The details form
 *   was still editing `accounts.sales_marketing_names`, which nothing has
 *   read since the roster replaced it, so the page carried two editors for
 *   one thing and one silently did nothing.
 * - **900px → 1200px.** A five-column roster cannot breathe in 900px
 *   minus the docked Settings nav.
 */
export default async function CompanyProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const [accountResult, teamMembers, memberLoad] = await Promise.all([
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", user.account_id).single(),
    getTeamMembers(user.account_id!),
    getMemberTaskLoad(user.account_id!),
  ]);
  const account = accountResult.data as CompanyProfile | null;

  if (!account) return null;

  const address = formatAddress(account);
  const inHouseCount = teamMembers.filter((m) => m.kind === "in_house").length;
  const completeness = profileCompleteness(account, inHouseCount);
  const pct = (completeness.filled / completeness.total) * 100;

  return (
    <main className="flex w-full max-w-[1200px] flex-1 flex-col gap-4 p-6 md:p-8">
      {/* Identity: who this record is, and whether it is finished. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl border border-neutral-200 bg-white px-5 py-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white p-1.5">
          <CompanyLogoUpload accountId={account.id} logoUrl={account.logo_url} canEdit={canEdit} compact shape="tile" />
        </div>
        <div className="min-w-[200px] flex-1">
          <h1 className="truncate text-h1 leading-tight tracking-tight text-primary-900">{account.name}</h1>
          {address && <p className="truncate text-body-sm text-neutral-500">{address}</p>}
        </div>
        <div className="flex items-center gap-3.5 border-neutral-200 sm:border-l sm:pl-5">
          <div>
            <p
              className={`text-h2 font-bold leading-none tabular-nums ${
                completeness.complete ? "text-success-700" : "text-warning-800"
              }`}
            >
              {completeness.filled}
              <span className="text-h4 font-semibold text-neutral-400"> / {completeness.total}</span>
            </p>
            <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full ${completeness.complete ? "bg-success-600" : "bg-warning-400"}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
          <p className="max-w-[24ch] text-caption leading-relaxed text-neutral-500">
            {completeness.complete
              ? "Every field filled in. This record appears across GrowthOS."
              : `${completeness.missing.length} still to fill in. This record appears across GrowthOS.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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
          }}
        />

        <section className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-3.5">
            <h2 className="text-h4 text-primary-900">What&apos;s filled in</h2>
          </div>
          <ul className="px-5 py-2">
            {COMPLETENESS_FIELDS.map((field) => {
              const done = !completeness.missing.includes(field.label);
              return (
                <li
                  key={field.label}
                  className={`flex items-center gap-2.5 border-b border-neutral-100 py-2 text-body-sm capitalize last:border-b-0 ${
                    done ? "text-neutral-700" : "text-neutral-400"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-[17px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      done ? "bg-success-100 text-success-700" : "bg-warning-200 text-warning-800"
                    }`}
                  >
                    {done ? "✓" : "–"}
                  </span>
                  {field.label}
                  <span className="sr-only">{done ? "filled in" : "still to fill in"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* The people, at the foot of the page — the thing this record is for. */}
      <TeamRoster accountId={account.id} members={teamMembers} memberLoad={memberLoad} canEdit={canEdit} />
    </main>
  );
}
