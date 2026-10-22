import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsList, type CroAccountRow } from "@/components/cro/accounts-list";
import { CreateAccountDialog } from "@/components/cro/create-account-dialog";
import { PartnerAccessPanel, type PartnerRow } from "@/components/cro/partner-access-panel";
import { CroPortfolioSummary } from "@/components/cro/portfolio-summary";
import { AllUsersPanel } from "@/components/cro/all-users-panel";
import type { PersonRow } from "@/components/cro/people-bits";
import { CroTeamPanel } from "@/components/cro/team-panel";
import { FocusButton, SectionPane, SectionSwitcher } from "@/components/growth-mission/section-switcher";
import { getCurrentUser, needsAccountSelection, type UserRole } from "@/lib/auth/get-current-user";
import { CRO_LEADER_ROLES, MSP_ROLES } from "@/lib/auth/roles";
import { currentQuarter } from "@/lib/growth-mission/hours";
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

export const metadata: Metadata = { title: "CRO Leader Dashboard — GrowthMission" };

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
  if (!needsAccountSelection(user.role)) redirect("/headquarters");

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

  // People (client-confirmed, 2026-10-22, approved mockup "CRO Dashboard
  // People"): the CRO Leader team and every client's users are managed here,
  // not inside a client's Settings. CRO Admin only.
  let team: PersonRow[] = [];
  let clientUsers: PersonRow[] = [];
  if (isCroAdmin) {
    const [{ data: people }, { data: logins }] = await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, email, role, archived_at, account_id, accounts(name)")
        .neq("role", "partner")
        .is("removed_at", null)
        .order("full_name"),
      supabase.rpc("get_users_with_last_login", { p_account_id: null }),
    ]);
    const lastLogin = new Map(
      ((logins ?? []) as { user_id: string; last_sign_in_at: string | null }[]).map((r) => [r.user_id, r.last_sign_in_at])
    );
    const rows: PersonRow[] = (people ?? []).map((p) => {
      const account = Array.isArray(p.accounts) ? p.accounts[0] : p.accounts;
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role as UserRole,
        archived_at: p.archived_at,
        account_id: p.account_id,
        account_name: (account as { name: string } | null)?.name ?? null,
        last_sign_in_at: lastLogin.get(p.id) ?? null,
      };
    });
    // Active people first, then the deactivated, each A–Z.
    const byStatus = (a: PersonRow, b: PersonRow) => Number(!!a.archived_at) - Number(!!b.archived_at);
    team = rows.filter((r) => CRO_LEADER_ROLES.includes(r.role)).sort(byStatus);
    clientUsers = rows.filter((r) => MSP_ROLES.includes(r.role)).sort(byStatus);
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

  const clientsSection = (withFocus: boolean) => (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 text-primary-900">Clients</h2>
          <p className="text-body-sm text-neutral-500">Enter an account below to view it as that MSP would.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {withFocus && <FocusButton view="clients" label="Clients" tone="light" />}
          {isCroAdmin && <CreateAccountDialog />}
        </div>
      </div>
      <AccountsList accounts={accounts} quarter={quarter} />
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-8">
      <CroPortfolioSummary
        accounts={accounts}
        title={user.role === "partner" ? "Partner Dashboard" : "CRO Leader Dashboard"}
        viewerName={user.full_name}
        quarter={quarter}
      />

      {/* Client-confirmed (2026-10-22): the Command Center's switcher, for
          the dashboard's sections. Advisors, Service Team and partners only
          have Clients, so they get no switcher. */}
      {isCroAdmin ? (
        <SectionSwitcher
          label="CRO Leader dashboard sections"
          sections={[
            { view: "clients", label: "Clients", hash: "#clients", count: accounts.length },
            { view: "team", label: "CRO Leader Team", hash: "#team", count: team.filter((t) => !t.archived_at).length },
            { view: "users", label: "All Users", hash: "#users", count: clientUsers.filter((u) => !u.archived_at).length },
            { view: "partners", label: "Partners", hash: "#partners", count: partners.length },
          ]}
        >
          <SectionPane view="clients">{clientsSection(true)}</SectionPane>
          <SectionPane view="team">
            <CroTeamPanel members={team} currentUserId={user.id} focusSlot={<FocusButton view="team" label="CRO Leader Team" />} />
          </SectionPane>
          <SectionPane view="users">
            <AllUsersPanel
              users={clientUsers}
              clients={accounts.map((a) => ({ id: a.id, name: a.name }))}
              focusSlot={<FocusButton view="users" label="All Users" />}
            />
          </SectionPane>
          <SectionPane view="partners">
            <PartnerAccessPanel
              partners={partners}
              allAccounts={accounts}
              focusSlot={<FocusButton view="partners" label="Partners" tone="light" />}
            />
          </SectionPane>
        </SectionSwitcher>
      ) : (
        clientsSection(false)
      )}
    </main>
  );
}
