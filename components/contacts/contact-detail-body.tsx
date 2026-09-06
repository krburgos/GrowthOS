"use client";

import { Briefcase, Globe, Link2, Mail, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActivityTimeline, dayLabel, type ActivityRow } from "@/components/activities/activity-timeline";
import { EmailList } from "@/components/activities/email-list";
import { LogActivityDialog } from "@/components/activities/log-activity-dialog";
import { ContactAvatarUpload } from "@/components/contacts/contact-avatar-upload";
import { ContactListsCard, type ContactListMembership } from "@/components/contacts/contact-lists-card";
import {
  ContactOverviewForm,
  type ContactOverviewDefaults,
} from "@/components/contacts/contact-overview-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

interface OpportunityRow {
  id: string;
  name: string | null;
  value: number | null;
  created_at: string;
  stage: { name: string; stage_group: StageGroup } | undefined;
}

const STAGE_STRIPE: Record<StageGroup, string> = {
  open: "bg-secondary-500",
  won: "bg-success-600",
  lost: "bg-neutral-300",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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
 * Contact Detail — Concept B, "Two-Column CRM Record" (approved mockup,
 * client-confirmed round two of the Contact Detail redesign). A
 * persistent record rail (light neutral-50, deliberately *not* navy —
 * the app's real sidebar is the only dark rail on screen, per the
 * client's explicit "don't wreck the sidebar" direction) replaces the
 * old plain identity row; Overview's fields fold into the rail as a
 * glance ("Quick Facts") plus an Edit Details shortcut into the full
 * Overview tab, which still holds the complete view/edit form
 * unchanged. The right side gets a stat row (open pipeline, lifetime
 * won value, last activity — all derived from data already fetched,
 * no new queries) above the tabs.
 */
export function ContactDetailBody({
  contactId,
  accountId,
  companyId,
  canEdit,
  fullName,
  title,
  avatarUrl,
  email,
  phone,
  ownerName,
  statusName,
  temperature,
  score,
  linkedinUrl,
  company,
  statuses,
  owners,
  overviewDefaults,
  activities,
  emailActivities,
  opportunities,
  listMemberships,
}: {
  contactId: string;
  accountId: string;
  companyId: string | null;
  canEdit: boolean;
  fullName: string;
  title: string | null;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
  ownerName: string | undefined;
  statusName: string | undefined;
  temperature: "hot" | "cold" | null;
  score: number | null;
  linkedinUrl: string | null;
  company: { name: string; website: string | null; company_size: string | null } | undefined;
  statuses: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  overviewDefaults: ContactOverviewDefaults;
  activities: ActivityRow[];
  emailActivities: ActivityRow[];
  opportunities: OpportunityRow[];
  listMemberships: ContactListMembership[];
}) {
  const [activeTab, setActiveTab] = useState("activity");

  const openPipeline = opportunities
    .filter((o) => o.stage?.stage_group === "open")
    .reduce((sum, o) => sum + (o.value ?? 0), 0);
  const wonLifetime = opportunities
    .filter((o) => o.stage?.stage_group === "won")
    .reduce((sum, o) => sum + (o.value ?? 0), 0);
  const lastActivityLabel = activities.length > 0 ? dayLabel(activities[0].occurred_at) : "No activity yet";

  return (
    <div className="flex min-h-full flex-1">
      {/* ---- Record rail ---- */}
      <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 shadow-sm">
            <ContactAvatarUpload
              contactId={contactId}
              accountId={accountId}
              avatarUrl={avatarUrl}
              canEdit={canEdit}
              initials={initials(fullName)}
            />
          </div>
          <h1 className="text-h4 text-primary-900">{fullName}</h1>
          {(title || company?.name) && (
            <p className="text-body-sm text-neutral-500">
              {title}
              {title && company?.name && " · "}
              {company?.name}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-1.5">
            {statusName && (
              <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-caption font-semibold text-secondary-800">
                {statusName}
              </span>
            )}
            {temperature && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-caption font-semibold",
                  temperature === "hot" ? "bg-error-100 text-error-700" : "bg-primary-100 text-primary-700"
                )}
              >
                {temperature === "hot" ? "Hot" : "Cold"}
              </span>
            )}
            {score != null && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-700">
                Score {score}
              </span>
            )}
          </div>
          <div className="flex justify-center gap-2">
            {company?.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                aria-label={`${company.name}'s website`}
                title="Company website"
                className="flex size-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-primary-700 hover:text-white"
              >
                <Globe className="size-3.5" />
              </a>
            )}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${fullName}'s LinkedIn`}
                title="LinkedIn"
                className="flex size-7 items-center justify-center rounded-full bg-secondary-50 text-secondary-700 transition-colors hover:bg-secondary-700 hover:text-white"
              >
                <Link2 className="size-3.5" />
              </a>
            )}
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setActiveTab("overview")}
            >
              <Pencil className="mr-1.5 size-3.5" />
              Edit Details
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-neutral-200 pt-4">
          <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-400">Quick Facts</h2>
          <div className="flex items-start gap-2 text-body-sm text-neutral-700">
            <Mail className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
            <span className="min-w-0 break-words">{email}</span>
          </div>
          {phone && (
            <div className="flex items-start gap-2 text-body-sm text-neutral-700">
              <Phone className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
              <span>{phone}</span>
            </div>
          )}
          {ownerName && (
            <div className="flex items-start gap-2 text-body-sm text-neutral-700">
              <Briefcase className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
              <span>Owner: {ownerName}</span>
            </div>
          )}
        </div>

        <ContactListsCard contactId={contactId} accountId={accountId} memberships={listMemberships} />
      </aside>

      {/* ---- Main content ---- */}
      <div className="flex min-h-full flex-1 flex-col overflow-x-auto">
        <div className="max-w-4xl flex-1 p-6 md:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-3.5">
              <p className="text-h4 font-bold tabular-nums text-primary-900">{currency.format(openPipeline)}</p>
              <p className="text-caption text-neutral-500">Open Pipeline</p>
            </div>
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-3.5">
              <p className="text-h4 font-bold tabular-nums text-primary-900">{currency.format(wonLifetime)}</p>
              <p className="text-caption text-neutral-500">Lifetime Won Value</p>
            </div>
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-3.5">
              <p className="text-h4 font-bold tabular-nums text-primary-900">{lastActivityLabel}</p>
              <p className="text-caption text-neutral-500">Last Activity</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ContactOverviewForm
                contactId={contactId}
                accountId={accountId}
                companyId={companyId}
                canEdit={canEdit}
                statuses={statuses}
                owners={owners}
                defaults={overviewDefaults}
              />
            </TabsContent>

            <TabsContent value="activity">
              <div className="mb-4 flex justify-end">
                <LogActivityDialog accountId={accountId} contactId={contactId} />
              </div>
              <ActivityTimeline activities={activities} />
            </TabsContent>

            <TabsContent value="opportunities">
              <div className="mb-4 flex justify-end">
                <Button asChild size="sm">
                  <Link href={`/opportunities/new?contact_id=${contactId}`}>Create Opportunity</Link>
                </Button>
              </div>
              {opportunities.length === 0 ? (
                <p className="text-body text-neutral-500">No opportunities yet</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {opportunities.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/opportunities/${o.id}`}
                        className="flex items-center gap-4 rounded-lg border border-neutral-200 px-4 py-3.5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_6px_16px_-8px_rgba(10,25,46,.18)]"
                      >
                        {o.stage && <span className={cn("h-10 w-1 shrink-0 rounded-full", STAGE_STRIPE[o.stage.stage_group])} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-neutral-800">
                            {o.name || "Untitled opportunity"}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            {o.stage && <Badge variant={STAGE_GROUP_BADGE_VARIANT[o.stage.stage_group]}>{o.stage.name}</Badge>}
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
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="emails">
              <EmailList activities={emailActivities} contactName={fullName} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
