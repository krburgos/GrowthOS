import type { Metadata } from "next";

import { GosDashboardView } from "@/components/gos-dashboard/gos-dashboard-view";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "GOS Dashboard — GrowthOS" };

const LOG_HOURS_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * GOS Dashboard — branch-only mockup (gos-dashboard-hours-mockup,
 * 2026-09-17). Adds the Playbook doc's readiness gate, its KPI dashboard
 * band, and per-workstream hours cards on top of the sample-data mockup.
 * Only the account website is read for real; every hour, KPI count and
 * mapping is sample data held in the browser (components/gos-dashboard/
 * mockup-store.tsx). Not intended for main.
 */
export default async function GosDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("website").eq("id", user.account_id).maybeSingle();

  return (
    <GosDashboardView
      website={account?.website ?? null}
      canLogHours={LOG_HOURS_ROLES.includes(user.role)}
      canEditMapping={user.role === "cro_admin"}
    />
  );
}
