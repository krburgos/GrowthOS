import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampaignComposerForm } from "@/components/campaigns/campaign-composer-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New Campaign — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/** App Flow §4.7 (G3) — Compose Campaign. */
export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!EDIT_ROLES.includes(user.role)) redirect("/campaigns");

  const supabase = await createClient();

  const [{ data: listRows }, { data: memberRows }, { data: connectionRows }] = await Promise.all([
    supabase.from("lists").select("id, name").is("archived_at", null).order("name"),
    supabase.from("list_members").select("list_id"),
    supabase
      .from("email_connections")
      .select("id, provider, email_address, users(full_name)")
      .eq("status", "connected")
      .is("archived_at", null)
      .neq("user_id", user.id),
  ]);

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.list_id, (memberCounts.get(row.list_id) ?? 0) + 1);
  }

  const lists = (listRows ?? []).map((l) => ({ id: l.id, name: l.name, count: memberCounts.get(l.id) ?? 0 }));

  const fromOptions = (connectionRows ?? []).map((c) => {
    const owner = Array.isArray(c.users) ? c.users[0] : c.users;
    const providerLabel = c.provider === "google" ? "Google" : "Microsoft";
    return { id: c.id, label: `${owner?.full_name ?? "Unknown"} — ${c.email_address} (${providerLabel})` };
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">New Campaign</h1>
        <p className="text-body text-neutral-500">Compose an email to send to one of your lists.</p>
      </div>
      <CampaignComposerForm
        accountId={user.account_id!}
        currentUserName={user.full_name}
        lists={lists}
        fromOptions={fromOptions}
      />
    </main>
  );
}
