import type { Metadata } from "next";

import { StagesManager } from "@/components/settings/stages-manager";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Opportunity Stages — GrowthOS" };

/**
 * Settings → Opportunity Stages. Client-confirmed deviation from the
 * Backend Schema's fixed opportunity_stage enum — customizable per
 * account, same shape as Contact Statuses, restricted to Owner/Admin
 * (and CRO Admin/Advisor for any account) since it reconfigures the
 * pipeline every user's board depends on, not a per-record edit.
 */
export default async function OpportunityStagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("opportunity_stages")
    .select("id, name, stage_group, sort_order, is_default")
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order("sort_order");

  return (
    <main className="w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-2 text-h1 text-primary-900">Opportunity Stages</h1>
      <p className="mb-6 text-body text-neutral-500">
        Every stage needs a Group so the board knows how to color it and when to mark an
        opportunity closed.
      </p>
      <StagesManager stages={stages ?? []} canEdit={canEdit} accountId={user.account_id!} />
    </main>
  );
}
