import { redirect } from "next/navigation";

import { MissionGuide } from "@/components/guide/mission-guide";
import { CroLeaderBanner } from "@/components/shell/cro-leader-banner";
import { MobileNavProvider } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import { SIDEBAR_ACCESS } from "@/lib/auth/nav-permissions";
import { currentQuarter } from "@/lib/growth-mission/hours";
import { getNavSummary } from "@/lib/growth-mission/queries";
import { COMPANY_PROFILE_COLUMNS, profileCompleteness, type CompanyProfile } from "@/lib/accounts/company-profile";
import { countAnswered } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";
import { countAnswered as countVisionBoardAnswered } from "@/lib/vision-board/sections";

/**
 * The real sidebar + top bar shell (Design System §8.9-§8.10, App Flow
 * §2), wrapping every MSP-context screen. Client-confirmed addition
 * (2026-09-08) — the "viewing as" flow this shell always expected to
 * eventually wire is now live: getCurrentUser() resolves an effective
 * account_id (and viewingAccountName) for a CRO Leader or partner
 * session once they've entered an account via POST /api/cro/enter, and
 * the CroLeaderBanner (components/shell/cro-leader-banner.tsx) renders
 * here whenever that's set — same banner regardless of whether the
 * viewer is CRO Leader or partner, since App Flow §2.5 doesn't
 * distinguish the two for this purpose.
 *
 * Sizing note: every level here uses plain `flex`/`flex-1`/`flex-col`,
 * not `min-h-full`. `flex-1` (flex-grow) and the default
 * `align-items: stretch` size these boxes off the flex layout itself —
 * no percentage-height resolution needed anywhere below `<body>`
 * (which is the one place that actually needs an explicit `h-full`,
 * app/layout.tsx). A `min-h-full` on an intermediate flex item resolves
 * against that item's own (indefinite, content-driven) box rather than
 * the viewport, which was producing extra blank scrollable space on
 * short-content pages (Settings, Contact Detail) — removing the
 * percentage math instead of trying to anchor it correctly everywhere.
 *
 * Width note: the content column also needs `min-w-0`. A flex item's
 * default `min-width` is `auto`, which resolves to its content's
 * intrinsic width — so without this, a wide table inside `{children}`
 * would refuse to shrink below its own natural width no matter how
 * much room `Sidebar` took, and the whole row would overflow the
 * viewport instead of the table's own `overflow-x-auto` wrapper
 * catching it. This is the same fix, on the width axis, applied
 * wherever a fixed-width rail sits next to a flex-1 content column
 * (Settings' `SettingsPanel`, Contact Detail's record rail).
 */
export default async function MspShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A CRO Leader or partner role only ever reaches this shell once
  // they've entered an MSP account (POST /api/cro/enter) — until then,
  // /cro is their home.
  if (needsAccountSelection(user.role) && !user.account_id) redirect("/cro");

  const supabase = await createClient();
  const [{ data: questionnaireResponse }, { data: visionBoardResponse }, nav, { data: profileRow }, { count: inHouseCount }] = await Promise.all([
    supabase
      .from("growth_questionnaire_responses")
      .select("answers, completed_at")
      .eq("account_id", user.account_id)
      .maybeSingle(),
    supabase
      .from("vision_board_responses")
      .select("answers, completed_at")
      .eq("account_id", user.account_id)
      .maybeSingle(),
    getNavSummary(user.account_id!, currentQuarter()),
    // The bell's Company Profile reminder (client-confirmed, 2026-10-15) scores
    // the same eleven fields as the Headquarters card, roster included.
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", user.account_id).maybeSingle(),
    supabase
      .from("account_team_members")
      .select("id", { count: "exact", head: true })
      .eq("account_id", user.account_id)
      .eq("kind", "in_house")
      .is("archived_at", null),
  ]);
  const profile = profileRow
    ? profileCompleteness(profileRow as unknown as CompanyProfile, inHouseCount ?? 0)
    : null;
  const questionnaireAnsweredCount = countAnswered((questionnaireResponse?.answers as Record<string, unknown>) ?? {});
  const questionnaireComplete = !!questionnaireResponse?.completed_at;
  const visionBoardAnsweredCount = countVisionBoardAnswered((visionBoardResponse?.answers as Record<string, unknown>) ?? {});
  const visionBoardComplete = !!visionBoardResponse?.completed_at;

  return (
    /* MobileNavProvider joins the top bar's hamburger to the drawer the
       Sidebar renders below `lg` — the two sit in different subtrees, and
       the alternative was the top bar owning the navigation markup. */
    <MobileNavProvider>
      <div className="flex flex-1 flex-col">
        {user.viewingAccountName && <CroLeaderBanner companyName={user.viewingAccountName} />}
        <div className="flex min-h-0 flex-1">
          <Sidebar
            access={SIDEBAR_ACCESS[user.role]}
            overdueOrders={nav.overdueOrders}
            withBanner={!!user.viewingAccountName}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              fullName={user.full_name}
              avatarUrl={user.avatar_url}
              accountName={(profileRow as { name?: string } | null)?.name ?? user.viewingAccountName}
              accountLogoUrl={(profileRow as { logo_url?: string | null } | null)?.logo_url}
              access={SIDEBAR_ACCESS[user.role]}
              accountId={user.account_id!}
              credits={nav.credits}
              questionnaireAnsweredCount={questionnaireAnsweredCount}
              questionnaireComplete={questionnaireComplete}
              visionBoardAnsweredCount={visionBoardAnsweredCount}
              visionBoardComplete={visionBoardComplete}
              profileFilled={profile?.filled}
              profileTotal={profile?.total}
              profileComplete={profile?.complete ?? true}
            />
            {children}
            {/* Mission Control, option A (preview branch, 2026-10-23). */}
            <MissionGuide accountId={user.account_id!} role={user.role} />
          </div>
        </div>
      </div>
    </MobileNavProvider>
  );
}
