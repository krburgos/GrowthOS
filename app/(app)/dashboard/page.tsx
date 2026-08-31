import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";

export const metadata: Metadata = { title: "Dashboard — GrowthOS" };

/**
 * MSP landing (App Flow §4.3, C1). Placeholder — the real pipeline
 * summary / activity feed / KPI snapshot is Milestone 11; the sidebar/top
 * bar shell around it is Milestone 5.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isCroLeaderRole(user.role)) redirect("/cro");

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-2 p-6 md:p-8">
      <h1 className="text-h1 text-primary-900">Dashboard</h1>
      <p className="text-body text-neutral-500">
        Signed in as {user.full_name} ({user.role}). Full shell and dashboard content arrive in
        later milestones.
      </p>
    </main>
  );
}
