import type { Metadata } from "next";

import { SettingsNav } from "@/components/settings/settings-nav";
import { StatusesManager } from "@/components/settings/statuses-manager";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact Statuses — GrowthOS" };

/**
 * App Flow §4.9, I3 ("Custom Statuses" in the doc) — renamed to "Contact
 * Statuses" in the UI for clarity now that Opportunity Stages exists as
 * a separate, similarly-shaped screen. Backend Schema §2 restricts
 * management to Owner/Admin/CRO Admin/CRO Advisor specifically (narrower
 * than the general Companies/Contacts edit list).
 */
export default async function StatusesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const { data: statuses } = await supabase
    .from("contact_statuses")
    .select("id, name, sort_order, is_default")
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order("sort_order");

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <SettingsNav />
      <h1 className="mb-6 text-h1 text-primary-900">Contact Statuses</h1>
      <StatusesManager statuses={statuses ?? []} canEdit={canEdit} accountId={user.account_id!} />
    </main>
  );
}
