import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsList, type CroAccountRow } from "@/components/cro/accounts-list";
import { CreateAccountDialog } from "@/components/cro/create-account-dialog";
import { PartnerAccessPanel, type PartnerRow } from "@/components/cro/partner-access-panel";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CRO Leader Dashboard — GrowthOS" };

/**
 * App Flow §4.10 (J1) — CRO Leader Dashboard. Client-confirmed same-day
 * addition (2026-09-08): also serves as the Partner Dashboard — the
 * account list is role-aware (CRO Leader roles see every account,
 * unconditionally; partner sees only accounts in partner_account_grants)
 * rather than being two separate screens, since both are fundamentally
 * "search and enter an MSP account." "New MSP Account" and the Partners
 * management panel are CRO Admin only.
 */
export default async function CroDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsAccountSelection(user.role)) redirect("/dashboard");

  const supabase = await createClient();
  const isCroAdmin = user.role === "cro_admin";

  let accounts: CroAccountRow[];
  if (user.role === "partner") {
    const { data } = await supabase
      .from("partner_account_grants")
      .select("accounts(id, name, website)")
      .eq("partner_user_id", user.id);
    accounts = (data ?? [])
      .map((row) => (Array.isArray(row.accounts) ? row.accounts[0] : row.accounts))
      .filter((a): a is CroAccountRow => !!a);
  } else {
    const { data } = await supabase
      .from("accounts")
      .select("id, name, website")
      .is("archived_at", null)
      .order("name");
    accounts = data ?? [];
  }

  let partners: PartnerRow[] = [];
  if (isCroAdmin) {
    const [{ data: partnerUsers }, { data: grantRows }] = await Promise.all([
      supabase.from("users").select("id, full_name, email").eq("role", "partner").is("archived_at", null).order("full_name"),
      supabase.from("partner_account_grants").select("partner_user_id, accounts(id, name)"),
    ]);

    const grantsByPartner = new Map<string, { accountId: string; accountName: string }[]>();
    for (const row of grantRows ?? []) {
      const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
      if (!account) continue;
      const list = grantsByPartner.get(row.partner_user_id) ?? [];
      list.push({ accountId: account.id, accountName: account.name });
      grantsByPartner.set(row.partner_user_id, list);
    }

    partners = (partnerUsers ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      grants: grantsByPartner.get(p.id) ?? [],
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">
            {user.role === "partner" ? "Partner Dashboard" : "CRO Leader Dashboard"}
          </h1>
          <p className="text-body text-neutral-500">
            Signed in as {user.full_name} ({user.role}). Enter an account below to view it as that MSP would.
          </p>
        </div>
        {isCroAdmin && <CreateAccountDialog />}
      </div>

      <AccountsList accounts={accounts} />

      {isCroAdmin && <PartnerAccessPanel partners={partners} allAccounts={accounts} />}
    </main>
  );
}
