import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { ActivityRow } from "@/components/activities/activity-timeline";
import {
  CompanyDetailBody,
  type CompanyContactRow,
  type CompanyOpportunityRow,
} from "@/components/companies/company-detail-body";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company — GrowthMission" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

function one<T>(field: unknown): T | undefined {
  return (Array.isArray(field) ? field[0] : field) ?? undefined;
}

/**
 * Client-confirmed addition (2026-09-08) — Company Detail: the company's
 * own record plus every contact and opportunity linked to it
 * (`contacts`/`opportunities` both carry `company_id` directly). "Merge
 * with another company" lives here, not on Contact Detail.
 *
 * Client-confirmed refresh (2026-10-14, approved mockup "Company Detail
 * Refresh"): laid out like Contact Detail (see CompanyDetailBody), with a
 * new Activity tab. That tab reads the activities of this company's
 * contacts and opportunities; nothing new is stored. The same rows give
 * each contact its Last Activity.
 */
export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, website, linkedin_url, industry, company_size, phone, address_line1, city, state, logo_url")
    .eq("id", id)
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .single();

  if (!company) notFound();

  const canEdit = EDIT_ROLES.includes(user.role);

  const [{ data: contactRows }, { data: opportunityRows }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, title, email, contact_statuses(name, color)")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("opportunities")
      // No typed value here: the client keeps it to the opportunity's own page and Reports (2026-10-14).
      .select(
        "id, name, stage_entered_at, contacts(full_name), users(full_name), opportunity_stages(name, stage_group, win_probability)"
      )
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const contactIds = (contactRows ?? []).map((c) => c.id);
  const opportunityIds = (opportunityRows ?? []).map((o) => o.id);
  const parents = [
    contactIds.length > 0 ? `contact_id.in.(${contactIds.join(",")})` : null,
    opportunityIds.length > 0 ? `opportunity_id.in.(${opportunityIds.join(",")})` : null,
  ].filter(Boolean);

  const { data: activityRows } =
    parents.length > 0
      ? await supabase
          .from("activities")
          .select(
            "id, type, subject, body, occurred_at, due_at, completed_at, contact_id, users(full_name, email), contacts(id, full_name)"
          )
          .or(parents.join(","))
          .is("archived_at", null)
          .order("occurred_at", { ascending: false })
          .limit(500)
      : { data: [] };

  const lastActivity = new Map<string, string>();
  for (const a of activityRows ?? []) {
    if (a.contact_id && !lastActivity.has(a.contact_id)) lastActivity.set(a.contact_id, a.occurred_at);
  }

  const contacts: CompanyContactRow[] = (contactRows ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    title: c.title,
    email: c.email,
    status: one<{ name: string; color: string }>(c.contact_statuses) ?? null,
    last_activity_at: lastActivity.get(c.id) ?? null,
  }));

  const opportunities: CompanyOpportunityRow[] = (opportunityRows ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    stage_entered_at: o.stage_entered_at,
    contact_name: one<{ full_name: string }>(o.contacts)?.full_name ?? null,
    owner_name: one<{ full_name: string }>(o.users)?.full_name ?? null,
    stage: one<{ name: string; stage_group: StageGroup; win_probability: number }>(o.opportunity_stages),
  }));

  const { logo_url: logoUrl, id: companyId, ...fields } = company;

  return (
    <CompanyDetailBody
      companyId={companyId}
      accountId={user.account_id!}
      canEdit={canEdit}
      company={{
        name: fields.name,
        website: fields.website ?? undefined,
        linkedin_url: fields.linkedin_url ?? undefined,
        industry: fields.industry ?? undefined,
        company_size: fields.company_size ?? undefined,
        phone: fields.phone ?? undefined,
        address_line1: fields.address_line1 ?? undefined,
        city: fields.city ?? undefined,
        state: fields.state ?? undefined,
      }}
      logoUrl={logoUrl}
      contacts={contacts}
      opportunities={opportunities}
      activities={(activityRows ?? []) as ActivityRow[]}
    />
  );
}
