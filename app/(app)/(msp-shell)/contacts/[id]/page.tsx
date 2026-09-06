import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline, type ActivityRow } from "@/components/activities/activity-timeline";
import { EmailList } from "@/components/activities/email-list";
import { LogActivityDialog } from "@/components/activities/log-activity-dialog";
import { ContactAvatarUpload } from "@/components/contacts/contact-avatar-upload";
import { ContactOverviewForm } from "@/components/contacts/contact-overview-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contact — GrowthOS" };

const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

const STAGE_STRIPE: Record<StageGroup, string> = {
  open: "bg-secondary-500",
  won: "bg-success-600",
  lost: "bg-neutral-300",
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * App Flow §4.4, D2 — Contact Detail. The unified activity timeline
 * (PRD §6.5) is the same component mounted on Opportunity Detail;
 * Emails is a filtered view of the same Activity data (App Flow §4.4).
 *
 * Client-confirmed modernization pass (approved mockup): a real
 * identity header (avatar upload, title/company subtitle, status/temp/
 * score chips) replaces the bare `<h1>{full_name}</h1>`; Opportunities
 * moved from a plain list to stage-colored cards matching the Kanban
 * board's own visual language; Emails gets a dedicated mail-list
 * component (still the same filtered Activity data, per the App Flow
 * doc — no live inbox exists yet).
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
        .select("id, name, value, created_at, opportunity_stages(name, stage_group)")
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
  const statusField = contact.contact_statuses as unknown;
  const status = (Array.isArray(statusField) ? statusField[0] : statusField) as { name: string } | undefined;

  const activities = (activityRows ?? []) as ActivityRow[];
  const emailActivities = activities.filter((a) => a.type === "email");
  const canEdit = CAN_EDIT_ROLES.includes(user.role);

  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500">
          <ContactAvatarUpload
            contactId={contact.id}
            accountId={user.account_id!}
            avatarUrl={contact.avatar_url}
            canEdit={canEdit}
            initials={initials(contact.full_name)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 text-primary-900">{contact.full_name}</h1>
          {(contact.title || company?.name) && (
            <p className="text-body-sm text-neutral-500">
              {contact.title}
              {contact.title && company?.name && " · "}
              {company?.name}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status && (
              <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-caption font-semibold text-secondary-800">
                {status.name}
              </span>
            )}
            {contact.temperature && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-caption font-semibold",
                  contact.temperature === "hot" ? "bg-error-100 text-error-700" : "bg-primary-100 text-primary-700"
                )}
              >
                {contact.temperature === "hot" ? "Hot" : "Cold"}
              </span>
            )}
            {contact.score != null && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-700">
                Score {contact.score}
              </span>
            )}
          </div>
        </div>
      </div>

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
            canEdit={canEdit}
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
            <ul className="flex flex-col gap-2.5">
              {(opportunityRows ?? []).map((o) => {
                const stageField = o.opportunity_stages as unknown;
                const stage = (Array.isArray(stageField) ? stageField[0] : stageField) as
                  | { name: string; stage_group: StageGroup }
                  | undefined;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/opportunities/${o.id}`}
                      className="flex items-center gap-4 rounded-lg border border-neutral-200 px-4 py-3.5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_6px_16px_-8px_rgba(10,25,46,.18)]"
                    >
                      {stage && <span className={cn("h-10 w-1 shrink-0 rounded-full", STAGE_STRIPE[stage.stage_group])} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-neutral-800">
                          {o.name || "Untitled opportunity"}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {stage && <Badge variant={STAGE_GROUP_BADGE_VARIANT[stage.stage_group]}>{stage.name}</Badge>}
                          <span className="text-caption text-neutral-400">
                            Created {new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-h4 font-bold tabular-nums text-primary-900">
                        {o.value != null ? currency.format(o.value) : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="emails">
          <EmailList activities={emailActivities} contactName={contact.full_name} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
