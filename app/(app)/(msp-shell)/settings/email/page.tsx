import type { Metadata } from "next";

import { EmailConnectionManager, type EmailConnectionRow } from "@/components/settings/email-connection-manager";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connected Email Account — GrowthOS" };

/**
 * App Flow §4.9, I2 — Connected Email Accounts. Connecting/disconnecting
 * stays strictly the logged-in user's own action, no CRO Leader override
 * (Backend Schema §6.3) — RLS enforces the same scoping this query
 * already applies explicitly. Client-confirmed amendment (2026-09-08):
 * the connection's name/provider/address (never its tokens) are now
 * visible account-wide, so teammates can pick it as a From identity on
 * Contact Detail's quick-send Email button — copy below updated to say
 * so plainly rather than the original "yours alone" claim.
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
    <main className="w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-2 text-h1 text-primary-900">Connected Email Account</h1>
      <p className="mb-6 text-body text-neutral-500">
        Connect the mailbox campaigns will send from. Only you can connect or disconnect it, and no one else
        can ever see or use its access tokens — but your name, provider, and address are visible to your
        teammates, who can pick it as a &quot;From&quot; identity when quick-sending an email from a contact.
      </p>
      <EmailConnectionManager connection={connection as EmailConnectionRow | null} />
    </main>
  );
}
