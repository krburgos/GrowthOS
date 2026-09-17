import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsList, type CroAccountRow } from "@/components/cro/accounts-list";
import { CreateAccountDialog } from "@/components/cro/create-account-dialog";
import { PartnerAccessPanel, type PartnerRow } from "@/components/cro/partner-access-panel";
import { CroPortfolioSummary } from "@/components/cro/portfolio-summary";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import { currentQuarter } from "@/lib/gos-dashboard/hours";
import { createClient } from "@/lib/supabase/server";

/** No activity in over two weeks marks an account as idle on the list and in the "Needs attention" filter. */
const IDLE_DAYS = 14;

interface PortfolioRow {
  account_id: string;
  questionnaire_complete: boolean;
  vision_board_complete: boolean;
  committed_hours: number | string;
  achieved_hours: number | string;
  last_activity_at: string | null;
}

export const metadata: Metadata = { title: "CRO Leader Dashboard — GrowthOS" };

/**
 * Client-confirmed (2026-09-17): CRO Leader's own account always sits at the
 * top of the account list, ahead of the alphabetical run — it's the account
 * the team opens most often. Matched by name, the same way it appears in the
 * list itself; every other account keeps its A–Z order.
 */
const PINNED_ACCOUNT_NAME = "CRO Leader";

function pinnedFirst(accounts: CroAccountRow[]): CroAccountRow[] {
  return [...accounts].sort((a, b) => {
    const aPinned = a.name === PINNED_ACCOUNT_NAME;
    const bPinned = b.name === PINNED_ACCOUNT_NAME;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

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

  const quarter = currentQuarter();
  const supabase = await createClient();
  const isCroAdmin = user.role === "cro_admin";

  let baseAccounts: { id: string; name: string; website: string | null }[];
  if (user.role === "partner") {
    const { data } = await supabase
      .from("partner_account_grants")
      .select("accounts(id, name, website)")
      .eq("partner_user_id", user.id);
    baseAccounts = (data ?? [])
      .map((row) => (Array.isArray(row.accounts) ? row.accounts[0] : row.accounts))
      .filter((a): a is { id: string; name: string; website: string | null } => !!a);
  } else {
    const { data } = await supabase
      .from("accounts")
      .select("id, name, website")
      .is("archived_at", null)
      .order("name");
    baseAccounts = data ?? [];
  }

  // One round trip for every account's status columns (Backend Schema §7).
  const { data: portfolioRows } = await supabase.rpc("cro_account_portfolio");
  const statsById = new Map<string, PortfolioRow>(
    ((portfolioRows ?? []) as PortfolioRow[]).map((r) => [r.account_id, r] as const)
  );
  const idleBefore = Date.now() - IDLE_DAYS * 86400000;

  const accounts: CroAccountRow[] = pinnedFirst(
    baseAccounts.map((a) => {
      const stats = statsById.get(a.id);
      const lastActivityAt = stats?.last_activity_at ?? null;
      return {
        id: a.id,
        name: a.name,
        website: a.website,
        questionnaireComplete: stats?.questionnaire_complete ?? false,
        visionBoardComplete: stats?.vision_board_complete ?? false,
        committedHours: Number(stats?.committed_hours ?? 0),
        achievedHours: Number(stats?.achieved_hours ?? 0),
        lastActivityAt,
        idle: !lastActivityAt || new Date(lastActivityAt).getTime() < idleBefore,
      };
    })
  );

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
      <CroPortfolioSummary
        accounts={accounts}
        title={user.role === "partner" ? "Partner Dashboard" : "CRO Leader Dashboard"}
        viewerName={user.full_name}
        quarter={quarter}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body text-neutral-500">Enter an account below to view it as that MSP would.</p>
        </div>
        {isCroAdmin && <CreateAccountDialog />}
      </div>

      <AccountsList accounts={accounts} quarter={quarter} />

      {isCroAdmin && <PartnerAccessPanel partners={partners} allAccounts={accounts} />}
    </main>
  );
}
