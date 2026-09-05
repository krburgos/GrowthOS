import type { Metadata } from "next";

import { EmailConnectionManager, type EmailConnectionRow } from "@/components/settings/email-connection-manager";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connected Email Accounts — GrowthOS" };

/**
 * App Flow §4.9, I2 — Connected Email Accounts. Strictly the logged-in
 * user's own connection, no CRO Leader override (Backend Schema §6.3) —
 * RLS enforces the same scoping this query already applies explicitly.
 */
export default async function ConnectedEmailAccountsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("email_connections")
    .select("id, provider, email_address, status, token_expires_at")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <SettingsNav />
      <h1 className="mb-2 text-h1 text-primary-900">Connected Email Accounts</h1>
      <p className="mb-6 text-body text-neutral-500">
        Connect the mailbox campaigns will send from. This connection is yours alone — no one else on your
        team, including admins, can see or use it.
      </p>
      <EmailConnectionManager connection={connection as EmailConnectionRow | null} />
    </main>
  );
}
