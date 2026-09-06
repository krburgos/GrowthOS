import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline, type ActivityRow } from "@/components/activities/activity-timeline";
import { LogActivityDialog } from "@/components/activities/log-activity-dialog";
import { ContactOverviewForm } from "@/components/contacts/contact-overview-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact — GrowthOS" };

const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.4, D2 — Contact Detail. The unified activity timeline
 * (PRD §6.5) is the same component mounted on Opportunity Detail;
 * Emails is a filtered view of the same Activity data (App Flow §4.4).
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
      "id, first_name, last_name, full_name, title, email, phone, status_id, owner_id, notes, score, temperature, linkedin_url, company_id, companies(name, website, industry, company_size, phone, address_line1, city, state)"
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!contact) notFound();

  const [{ data: statuses }, { data: owners }, { data: activityRows }, { data: opportunityRows }] =
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
        .select("id, name, value, opportunity_stages(name, stage_group)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
    ]);

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

  const activities = (activityRows ?? []) as ActivityRow[];
  const emailActivities = activities.filter((a) => a.type === "email");

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">{contact.full_name}</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContactOverviewForm
            contactId={contact.id}
            accountId={user.account_id!}
            companyId={contact.company_id}
            canEdit={CAN_EDIT_ROLES.includes(user.role)}
            statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
            owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
            defaults={{
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
          />
        </TabsContent>

        <TabsContent value="activity">
          <div className="mb-4 flex justify-end">
            <LogActivityDialog accountId={user.account_id!} contactId={contact.id} />
          </div>
          <ActivityTimeline activities={activities} />
        </TabsContent>

        <TabsContent value="opportunities">
          <div className="mb-4 flex justify-end">
            <Button asChild size="sm">
              <Link href={`/opportunities/new?contact_id=${contact.id}`}>Create Opportunity</Link>
            </Button>
          </div>
          {(opportunityRows ?? []).length === 0 ? (
            <p className="text-body text-neutral-500">No opportunities yet</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(opportunityRows ?? []).map((o) => {
                const stageField = o.opportunity_stages as unknown;
                const stage = (Array.isArray(stageField) ? stageField[0] : stageField) as
                  | { name: string; stage_group: StageGroup }
                  | undefined;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/opportunities/${o.id}`}
                      className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3 hover:bg-neutral-100"
                    >
                      <span className="text-body text-neutral-800">{o.name || "Untitled opportunity"}</span>
                      {stage && (
                        <Badge variant={STAGE_GROUP_BADGE_VARIANT[stage.stage_group]}>{stage.name}</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="emails">
          <ActivityTimeline activities={emailActivities} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
