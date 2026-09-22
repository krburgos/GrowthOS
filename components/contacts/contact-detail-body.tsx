"use client";

import { Briefcase, Building2, Globe, Link2, Mail, MapPin, Pencil, Phone } from "lucide-react";
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
import { SendEmailDialog, type FromOption } from "@/components/contacts/send-email-dialog";
import { HERO_ACTION_CLASS, HeroBand } from "@/components/shell/hero-band";
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "");
  }
}

function linkedinHandleOf(url: string): string {
  const match = url.match(/linkedin\.com\/(.+?)\/?(?:[?#].*)?$/i);
  return match ? match[1] : url.replace(/^https?:\/\//, "");
}

/**
 * Contact Detail — client-confirmed redesign (2026-09-22, approved mockup
 * "A"): the identity moves into the same navy HeroBand the Dashboard and
 * Command Center use, carrying the three figures with it as translucent
 * panels, and the actions become buttons beside the name.
 *
 * Three things this fixes, each a reason the old layout was reworked rather
 * than merely restyled:
 *
 * - The record rail was secondary-100, a teal slab no other page carries.
 *   The hero is the app's one heavy block of colour, so the page now gets
 *   its weight from the same place every other page does.
 * - "Make a Call" and "Send Email" were tiles the same size and shape as
 *   three statistics, in one row, so an action and a measurement were
 *   indistinguishable. Actions are buttons now; only measurements sit in
 *   the stat panels.
 * - Content was capped at max-w-4xl on a page far wider than that, leaving
 *   a large empty right margin. The tabs now take the full column, and the
 *   reference detail (links, lists, company) moves to a quiet white rail.
 *
 * What did NOT change: the tabs and everything inside them, the Overview
 * form, which fields exist, and who may edit them.
 *
 * Previously — Concept B, "Two-Column CRM Record" (approved mockup,
 * client-confirmed round two of the Contact Detail redesign). A
 * persistent record rail (deliberately *not* navy — the app's real
 * sidebar is the only dark rail on screen, per the client's explicit
 * "don't wreck the sidebar" direction) replaces the old plain identity
 * row; Overview's fields fold into the rail as a glance ("Quick Facts")
 * plus an Edit Details shortcut into the full Overview tab, which still
 * holds the complete view/edit form unchanged. The right side gets a
 * stat row (open pipeline, lifetime won value, last activity — all
 * derived from data already fetched, no new queries) above the tabs.
 *
 * Client-confirmed rail redesign ("Refined Card," approved mockup,
 * 2026-09-08): rail background is secondary-100 (chosen after
 * comparing five intensity steps of the app's own teal scale, 50–400,
 * live). Status/temperature/score became outlined chips instead of
 * flat-filled ones, Edit Details became a solid primary button, and
 * Website/Person LinkedIn moved out of the old icon-only row into a
 * labeled "Links" section (icon chip + label + domain/handle text).
 * Company LinkedIn (company.linkedinUrl) is deliberately not rendered
 * here anymore — it's still shown and editable on Company Detail, per
 * the client's direction to remove it specifically from the contact
 * profile.
 *
 * Sizing: rail and content are plain `flex`/`flex-1` flex items, no
 * `min-h-full` and no internal `overflow-y-auto` — the whole page
 * scrolls together, same as everywhere else in the shell, rather than
 * carving out an independently-scrolling region here. A `min-h-full`
 * previously here resolved against this row's own (indefinite) box
 * rather than the viewport, producing extra blank scrollable space
 * below short tab content — see the msp-shell layout's sizing note.
 * The content column also carries `min-w-0`, the same layout's width
 * note: without it, wide content on a tab (e.g. the Opportunities
 * table) would refuse to shrink below its own intrinsic width and
 * overflow the page instead of scrolling within its own bordered box.
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
  currentUserName,
  fromOptions,
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
  company: { name: string; website: string | null; linkedinUrl: string | null; company_size: string | null } | undefined;
  statuses: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  overviewDefaults: ContactOverviewDefaults;
  activities: ActivityRow[];
  emailActivities: ActivityRow[];
  opportunities: OpportunityRow[];
  listMemberships: ContactListMembership[];
  currentUserName: string;
  fromOptions: FromOption[];
}) {
  const [activeTab, setActiveTab] = useState("overview");

  // Client-confirmed formula (2026-09-15), replacing the real opportunity
  // sums these tiles showed before: Prospect Value is a company-size-driven
  // estimate ($200 x Employees x 12), not derived from this contact's own
  // opportunities at all. Opportunities Value is a fixed 3x multiple of it.
  const companyEmployees = Number(company?.company_size) || 0;
  const prospectValue = 200 * companyEmployees * 12;
  const opportunitiesValue = prospectValue * 3;
  const lastActivityLabel = activities.length > 0 ? dayLabel(activities[0].occurred_at) : "No activity yet";

  const contactLine = [title, company?.name].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <HeroBand>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25">
            <ContactAvatarUpload
              contactId={contactId}
              accountId={accountId}
              avatarUrl={avatarUrl}
              canEdit={canEdit}
              initials={initials(fullName)}
            />
          </div>

          <div className="min-w-[220px] flex-1">
            <h1 className="text-h2 text-white">{fullName}</h1>
            {contactLine && <p className="text-body-sm text-white/75">{contactLine}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {statusName && <HeroChip>{statusName}</HeroChip>}
              {temperature && <HeroChip tone={temperature}>{temperature === "hot" ? "Hot" : "Cold"}</HeroChip>}
              {score != null && <HeroChip>Score {score}</HeroChip>}
              {ownerName && <HeroChip>Salesperson: {ownerName}</HeroChip>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {phone && (
              <a href={`tel:${phone}`} className={HERO_ACTION_CLASS}>
                <Phone className="size-4" />
                Call
              </a>
            )}
            <SendEmailDialog
              contactId={contactId}
              contactName={fullName}
              contactEmail={email}
              currentUserName={currentUserName}
              fromOptions={fromOptions}
              variant="hero"
            />
            <LogActivityDialog accountId={accountId} contactId={contactId} variant="hero" />
            {canEdit && (
              <button type="button" onClick={() => setActiveTab("overview")} className={HERO_ACTION_CLASS}>
                <Pencil className="size-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HeroStat label="Prospect value" value={currency.format(prospectValue)} />
          <HeroStat label="Opportunities value" value={currency.format(opportunitiesValue)} />
          <HeroStat label="Last activity" value={lastActivityLabel} />
        </div>
      </HeroBand>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
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
              <ul className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto pr-1">
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
            <EmailList activities={emailActivities} contactName={fullName} contactEmail={email} />
          </TabsContent>
        </Tabs>
        </div>

        {/* ---- Reference rail ---- */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Quick facts</h2>
            </div>
            <div className="flex flex-col gap-2.5 px-4 py-3.5">
              <Fact icon={Mail}>{email}</Fact>
              {phone && <Fact icon={Phone}>{phone}</Fact>}
              {title && <Fact icon={Briefcase}>{title}</Fact>}
              {company?.name && <Fact icon={Building2}>{company.name}</Fact>}
              {company?.company_size && <Fact icon={MapPin}>{company.company_size} employees</Fact>}
            </div>
          </div>

          {(company?.website || linkedinUrl) && (
            <div className="rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Links</h2>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3.5">
                {company?.website && (
                  <LinkRow icon={Globe} href={company.website} label="Website" detail={hostnameOf(company.website)} />
                )}
                {linkedinUrl && (
                  <LinkRow icon={Link2} href={linkedinUrl} label="LinkedIn" detail={linkedinHandleOf(linkedinUrl)} />
                )}
              </div>
            </div>
          )}

          <ContactListsCard contactId={contactId} accountId={accountId} memberships={listMemberships} />
        </div>
      </div>
    </div>
  );
}

function HeroChip({ children, tone }: { children: React.ReactNode; tone?: "hot" | "cold" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-semibold",
        tone === "hot"
          ? "border-error-400/60 bg-error-400/15 text-error-300"
          : "border-white/20 bg-white/10 text-white/90"
      )}
    >
      {children}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-caption font-semibold uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-0.5 truncate text-h2 font-bold leading-tight tracking-tight tabular-nums text-white">{value}</p>
    </div>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-body-sm text-neutral-700">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function LinkRow({
  icon: Icon,
  href,
  label,
  detail,
}: {
  icon: typeof Globe;
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-md border border-neutral-200 px-2.5 py-2 transition-colors hover:border-secondary-400 hover:bg-secondary-50"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary-50 text-secondary-700">
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-caption font-semibold text-neutral-800">{label}</span>
        <span className="truncate text-caption text-neutral-500">{detail}</span>
      </span>
    </a>
  );
}
