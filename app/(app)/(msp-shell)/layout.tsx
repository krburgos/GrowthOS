import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";
import { SIDEBAR_ACCESS } from "@/lib/auth/nav-permissions";

/**
 * The real sidebar + top bar shell (Design System §8.9-§8.10, App Flow
 * §2), wrapping every MSP-context screen. The CRO Leader banner
 * (components/shell/cro-leader-banner.tsx) mounts here too once
 * Milestone 11 wires the "enter an MSP account" flow that gives it
 * something to show — this layout doesn't render it yet since there's
 * no "viewing as" state to reflect.
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
  // A CRO Leader role only ever reaches this shell once they've entered
  // an MSP account (Milestone 11) — until then, /cro is their home.
  if (isCroLeaderRole(user.role) && !user.account_id) redirect("/cro");

  return (
    <div className="flex flex-1">
      <Sidebar access={SIDEBAR_ACCESS[user.role]} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar fullName={user.full_name} access={SIDEBAR_ACCESS[user.role]} accountId={user.account_id!} />
        {children}
      </div>
    </div>
  );
}
