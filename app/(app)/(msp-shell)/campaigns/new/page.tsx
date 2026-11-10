import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampaignComposerForm } from "@/components/campaigns/campaign-composer-form";
import { CampaignsPausedNotice } from "@/components/campaigns/campaigns-paused-notice";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { CAMPAIGNS_PAUSED } from "@/lib/campaigns/paused";
import { CAMPAIGNS_HOME } from "@/lib/campaigns/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New Campaign — GrowthMission" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/** App Flow §4.7 (G3) — Compose Campaign. */
export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!EDIT_ROLES.includes(user.role)) redirect(CAMPAIGNS_HOME);

  const supabase = await createClient();

  // Only this account's lists (CRO Leader roles can read every account's),
  // each sized by a count, not by reading its members: that read stopped at
  // 1,000 rows across all lists (2026-11-10).
  const [{ data: listRows }, { data: connectionRows }] = await Promise.all([
    supabase.from("lists").select("id, name").eq("account_id", user.account_id).is("archived_at", null).order("name"),
    supabase
      .from("email_connections")
      .select("id, provider, email_address, users(full_name)")
      .eq("status", "connected")
      .is("archived_at", null)
      .neq("user_id", user.id),
  ]);

  const counts = await Promise.all(
    (listRows ?? []).map((l) =>
      supabase
        .from("list_members")
        .select("contact_id, contacts!inner(id)", { count: "exact", head: true })
        .eq("list_id", l.id)
        .is("contacts.archived_at", null)
    )
  );
  const lists = (listRows ?? []).map((l, i) => ({ id: l.id, name: l.name, count: counts[i].count ?? 0 }));

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
      {CAMPAIGNS_PAUSED && <CampaignsPausedNotice />}
      {/* Paused: the whole composer is greyed out and can't be used. */}
      <fieldset disabled={CAMPAIGNS_PAUSED} aria-disabled={CAMPAIGNS_PAUSED} className={CAMPAIGNS_PAUSED ? "opacity-60" : undefined}>
        <CampaignComposerForm
          accountId={user.account_id!}
          currentUserName={user.full_name}
          lists={lists}
          fromOptions={fromOptions}
        />
      </fieldset>
    </main>
  );
}
