import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set Password — GrowthOS" };

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No spec'd error state for a broken/expired invite link (unlike A3) —
  // falls back to the App Flow §6 general rule: standard 404 for a
  // broken/stale link.
  if (!user) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("users")
    .select("accounts(name)")
    .eq("id", user.id)
    .single();

  const accountsField = profile?.accounts as unknown;
  const companyName = Array.isArray(accountsField)
    ? (accountsField[0] as { name: string } | undefined)?.name
    : (accountsField as { name: string } | undefined)?.name;

  return (
    <>
      <h1 className="mb-1 text-h3 text-primary-900">
        {companyName ? `Join ${companyName} on GrowthOS` : "Set up your GrowthOS account"}
      </h1>
      <p className="mb-6 text-body-sm text-neutral-500">{user.email}</p>
      <AcceptInviteForm />
    </>
  );
}
