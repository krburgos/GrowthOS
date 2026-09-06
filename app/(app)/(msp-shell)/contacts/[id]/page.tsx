import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { ActivityRow } from "@/components/activities/activity-timeline";
import { ContactDetailBody } from "@/components/contacts/contact-detail-body";
import type { ContactListMembership } from "@/components/contacts/contact-lists-card";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact — GrowthOS" };

const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.4, D2 — Contact Detail. The unified activity timeline
 * (PRD §6.5) is the same component mounted on Opportunity Detail;
 * Emails is a filtered view of the same Activity data (App Flow §4.4).
 *
 * Client-confirmed modernization pass, round two (approved mockup) —
 * Concept B, "Two-Column CRM Record": a persistent record rail
 * (docked the same way SettingsPanel docks against the icon rail)
 * replaces the plain identity row and the Overview tab's job of
 * surfacing at-a-glance context; the rail is deliberately light
 * (neutral-50), not navy, so the app's real sidebar stays the only
 * dark rail on screen. All layout/state lives in ContactDetailBody
 * (a client component) since the rail's Edit Details button needs to
 * drive which tab is active — this page only fetches data.
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, full_name, title, email, phone, status_id, owner_id, notes, score, temperature, linkedin_url, avatar_url, company_id, contact_statuses(name), companies(name, website, industry, company_size, phone, address_line1, city, state)"
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!contact) notFound();

  const [{ data: statuses }, { data: owners }, { data: activityRows }, { data: opportunityRows }, { data: allLists }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("contact_statuses")
        .select("id, name")
        .eq("account_id", user.account_id)
        .is("archived_at", null)
        .order("sort_order"),
      supabase
        .from("users")
        .select("id, full_name")
        .eq("account_id", user.account_id)
        .is("archived_at", null)
        .order("full_name"),
      supabase
        .from("activities")
        .select("id, type, subject, body, occurred_at, due_at, completed_at, users(full_name)")
        .eq("contact_id", id)
        .is("archived_at", null)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, name, value, created_at, opportunity_stages(name, stage_group)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lists")
        .select("id, name, type")
        .eq("account_id", user.account_id)
        .is("archived_at", null)
        .order("name"),
      supabase.from("list_members").select("list_id").eq("contact_id", id),
    ]);

  // Static lists: membership is the list_members row itself. Smart
  // lists: compute_smart_list_members already folds in criteria matches,
  // manual list_members additions, and list_exclusions (Backend Schema
  // §7.4) — a per-list RPC call is cheap here since it's one contact,
  // unlike the Contacts table's dense per-row rendering.
  const staticMemberIds = new Set((memberRows ?? []).map((r) => r.list_id));
  const smartLists = (allLists ?? []).filter((l) => l.type === "smart");
  const smartMembership = await Promise.all(
    smartLists.map(async (list) => {
      const { data } = await supabase.rpc("compute_smart_list_members", { p_list_id: list.id });
      return (data ?? []).some((r: { contact_id: string }) => r.contact_id === id);
    })
  );
  const smartMemberIds = new Set(smartLists.filter((_, i) => smartMembership[i]).map((l) => l.id));
  const listMemberships: ContactListMembership[] = (allLists ?? [])
    .filter((l) => (l.type === "static" ? staticMemberIds.has(l.id) : smartMemberIds.has(l.id)))
    .map((l) => ({ id: l.id, name: l.name, type: l.type as "static" | "smart" }));

  type CompanyFields = {
    name: string;
    website: string | null;
    industry: string | null;
    company_size: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
  };
  const companiesField = contact.companies as unknown;
  const company = (Array.isArray(companiesField) ? companiesField[0] : companiesField) as
    | CompanyFields
    | undefined;
  const statusField = contact.contact_statuses as unknown;
  const status = (Array.isArray(statusField) ? statusField[0] : statusField) as { name: string } | undefined;

  const activities = (activityRows ?? []) as ActivityRow[];
  const emailActivities = activities.filter((a) => a.type === "email");
  const canEdit = CAN_EDIT_ROLES.includes(user.role);
  const ownerName = (owners ?? []).find((o) => o.id === contact.owner_id)?.full_name;

  const opportunities = (opportunityRows ?? []).map((o) => {
    const stageField = o.opportunity_stages as unknown;
    const stage = (Array.isArray(stageField) ? stageField[0] : stageField) as
      | { name: string; stage_group: StageGroup }
      | undefined;
    return { id: o.id, name: o.name, value: o.value, created_at: o.created_at, stage };
  });

  return (
    <ContactDetailBody
      contactId={contact.id}
      accountId={user.account_id!}
      companyId={contact.company_id}
      canEdit={canEdit}
      fullName={contact.full_name}
      title={contact.title}
      avatarUrl={contact.avatar_url}
      email={contact.email}
      phone={contact.phone}
      ownerName={ownerName}
      statusName={status?.name}
      temperature={contact.temperature}
      score={contact.score}
      linkedinUrl={contact.linkedin_url}
      company={company ? { name: company.name, website: company.website, company_size: company.company_size } : undefined}
      statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
      owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
      overviewDefaults={{
        first_name: contact.first_name,
        last_name: contact.last_name ?? "",
        title: contact.title ?? "",
        email: contact.email,
        phone: contact.phone ?? "",
        status_id: contact.status_id,
        owner_id: contact.owner_id ?? "",
        score: contact.score != null ? String(contact.score) : "",
        temperature: contact.temperature ?? "",
        linkedin_url: contact.linkedin_url ?? "",
        notes: contact.notes ?? "",
        company_name: company?.name ?? "",
        company_website: company?.website ?? "",
        company_industry: company?.industry ?? "",
        company_size: company?.company_size ?? "",
        company_phone: company?.phone ?? "",
        company_address_line1: company?.address_line1 ?? "",
        company_city: company?.city ?? "",
        company_state: company?.state ?? "",
      }}
      activities={activities}
      emailActivities={emailActivities}
      opportunities={opportunities}
      listMemberships={listMemberships}
    />
  );
}
