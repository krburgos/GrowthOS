import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";

export const metadata: Metadata = { title: "CRO Leader Dashboard — GrowthOS" };

/**
 * CRO Leader landing (App Flow §4.10, J1). Placeholder — the MSP
 * search-and-enter flow is Milestone 11.
 */
export default async function CroDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isCroLeaderRole(user.role)) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-2 p-6 md:p-8">
      <h1 className="text-h1 text-primary-900">CRO Leader Dashboard</h1>
      <p className="text-body text-neutral-500">
        Signed in as {user.full_name} ({user.role}). MSP search/switcher arrives in Milestone 11.
      </p>
    </main>
  );
}
