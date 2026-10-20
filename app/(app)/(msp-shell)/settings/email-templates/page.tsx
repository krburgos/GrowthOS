import type { Metadata } from "next";

import { EmailTemplatesManager, type EmailTemplateRow } from "@/components/settings/email-templates-manager";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Email Templates — GrowthMission" };

/**
 * Settings → Customizations → Email Templates (client-confirmed,
 * 2026-10-20). Editing is for the same roles as Contact Statuses and
 * Opportunity Stages; everyone else sees the list.
 */
export default async function EmailTemplatesPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const canEdit = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"].includes(user.role);

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("email_templates")
    .select("id, name, subject, body_html, use_count")
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order("name");

  return (
    <main className="w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-2 text-h1 text-primary-900">Email Templates</h1>
      <p className="mb-6 max-w-[70ch] text-body text-neutral-500">
        Reusable emails for the whole team. Anyone can pick one when emailing a contact, or save a new one from there.
        Fields like {"{First name}"} fill in for each contact.
      </p>
      <EmailTemplatesManager accountId={user.account_id} templates={(templates ?? []) as EmailTemplateRow[]} canEdit={canEdit} />
    </main>
  );
}
