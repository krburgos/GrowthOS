import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline, type ActivityRow } from "@/components/activities/activity-timeline";
import { LogActivityDialog } from "@/components/activities/log-activity-dialog";
import { OpportunityOverviewForm } from "@/components/opportunities/opportunity-overview-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Opportunity — GrowthOS" };

const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.5, E3 — Opportunity Detail. Core fields, notes, and its
 * own activity timeline (PRD §6.5) — the same shared component mounted
 * on Contact Detail.
 */
export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, name, stage, value, notes, contact_id, contacts(full_name), companies(name)")
    .eq("id", id)
    .single();

  if (!opportunity) notFound();

  const { data: activityRows } = await supabase
    .from("activities")
    .select("id, type, subject, body, occurred_at, due_at, completed_at, users(full_name)")
    .eq("opportunity_id", id)
    .is("archived_at", null)
    .order("occurred_at", { ascending: false });

  const contact = Array.isArray(opportunity.contacts) ? opportunity.contacts[0] : opportunity.contacts;
  const company = Array.isArray(opportunity.companies) ? opportunity.companies[0] : opportunity.companies;
  const canEdit = CAN_EDIT_ROLES.includes(user.role);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-1 text-h1 text-primary-900">
        {opportunity.name || (contact as { full_name?: string } | undefined)?.full_name || "Opportunity"}
      </h1>
      <p className="mb-6 text-body text-neutral-500">
        {opportunity.contact_id && (
          <Link href={`/contacts/${opportunity.contact_id}`} className="text-primary-700 hover:underline">
            {(contact as { full_name?: string } | undefined)?.full_name}
          </Link>
        )}
        {company && <> · {(company as { name?: string }).name}</>}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <OpportunityOverviewForm
          opportunityId={opportunity.id}
          canEdit={canEdit}
          defaults={{
            name: opportunity.name ?? "",
            stage: opportunity.stage,
            value: opportunity.value != null ? String(opportunity.value) : "",
            notes: opportunity.notes ?? "",
          }}
        />

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-h4 text-primary-900">Activity</h2>
            <LogActivityDialog accountId={user.account_id!} opportunityId={opportunity.id} />
          </div>
          <ActivityTimeline activities={(activityRows ?? []) as ActivityRow[]} />
        </div>
      </div>
    </main>
  );
}
