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
 */
export default async function MspShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A CRO Leader role only ever reaches this shell once they've entered
  // an MSP account (Milestone 11) — until then, /cro is their home.
  if (isCroLeaderRole(user.role) && !user.account_id) redirect("/cro");

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar access={SIDEBAR_ACCESS[user.role]} />
      <div className="flex min-h-full flex-1 flex-col">
        <TopBar fullName={user.full_name} access={SIDEBAR_ACCESS[user.role]} accountId={user.account_id!} />
        {children}
      </div>
    </div>
  );
}
