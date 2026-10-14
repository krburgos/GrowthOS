"use client";

import { Globe, Link2, MapPin, Pencil, Phone, Plus, Tag, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActivityTimeline, dayLabel, type ActivityRow } from "@/components/activities/activity-timeline";
import { CompanyLogoUpload } from "@/components/companies/company-logo-upload";
import { CompanyOverviewForm, type CompanyOverviewValues } from "@/components/companies/company-overview-form";
import {
  Fact,
  HeroChip,
  HeroStat,
  LinkRow,
  STAGE_STRIPE,
  TabCount,
  hostnameOf,
  initials,
} from "@/components/contacts/contact-detail-body";
import { StatusPill } from "@/components/contacts/status-pill";
import { HERO_ACTION_CLASS, HERO_PRIMARY_ACTION_CLASS, HeroBand } from "@/components/shell/hero-band";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { daysSince, employeesOf, opportunitiesValue, prospectValue, usd } from "@/lib/companies/value";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";

export interface CompanyContactRow {
  id: string;
  full_name: string;
  title: string | null;
  email: string;
  status: { name: string; color: string } | null;
  last_activity_at: string | null;
}

export interface CompanyOpportunityRow {
  id: string;
  name: string | null;
  stage_entered_at: string;
  contact_name: string | null;
  owner_name: string | null;
  stage: { name: string; stage_group: StageGroup; win_probability: number } | undefined;
}

/**
 * Company Detail — client-confirmed refresh (2026-10-14, approved mockup
 * "Company Detail Refresh"), rebuilt to match Contact Detail: the same navy
 * HeroBand (logo in a white circle, name, location, Industry and Employees
 * chips, Call / Website / Add Contact / Edit, and three figures), then
 * Overview / Contacts / Opportunities / Activity tabs beside a white
 * reference rail. Add Contact is the one solid action; it opens Add Contact
 * with this company filled in.
 *
 * Activity is new: every activity on this company's contacts or its
 * opportunities, newest first, each saying which contact it was with. There
 * is no Log button here, because an activity always belongs to a contact;
 * logging happens on the contact. No company Notes (client's choice).
 * Opportunities never show the typed Value (client, 2026-10-14).
 */
export function CompanyDetailBody({
  companyId,
  accountId,
  canEdit,
  company,
  logoUrl,
  contacts,
  opportunities,
  activities,
}: {
  companyId: string;
  accountId: string;
  canEdit: boolean;
  company: CompanyOverviewValues;
  logoUrl: string | null;
  contacts: CompanyContactRow[];
  opportunities: CompanyOpportunityRow[];
  activities: ActivityRow[];
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const location = [company.city, company.state].filter(Boolean).join(", ");
  const employees = employeesOf(company.company_size);
  const fullAddress = [company.address_line1, location].filter(Boolean).join(", ");
  const addContactHref = `/contacts/new?company_id=${companyId}`;

  const statusCounts = new Map<string, { name: string; color: string; count: number }>();
  for (const c of contacts) {
    if (!c.status) continue;
    const entry = statusCounts.get(c.status.name) ?? { ...c.status, count: 0 };
    entry.count += 1;
    statusCounts.set(c.status.name, entry);
  }
  const byStatus = [...statusCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <HeroBand>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white ring-[3px] ring-white/20">
            <CompanyLogoUpload
              companyId={companyId}
              accountId={accountId}
              logoUrl={logoUrl}
              canEdit={canEdit}
              initials={initials(company.name || "?")}
            />
          </div>

          <div className="min-w-[220px] flex-1">
            <h1 className="text-h2 text-white">{company.name}</h1>
            {location && <p className="text-body-sm text-white/75">{location}</p>}
            {(company.industry || employees > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {company.industry && <HeroChip>{company.industry}</HeroChip>}
                {employees > 0 && <HeroChip>{employees.toLocaleString()} Employees</HeroChip>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {company.phone && (
              <a href={`tel:${company.phone}`} className={HERO_ACTION_CLASS}>
                <Phone className="size-4" />
                Call
              </a>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className={HERO_ACTION_CLASS}>
                <Globe className="size-4" />
                Website
              </a>
            )}
            {canEdit && (
              <Link href={addContactHref} className={HERO_PRIMARY_ACTION_CLASS}>
                <Plus className="size-4" />
                Add Contact
              </Link>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("overview");
                  setEditing(true);
                }}
                className={HERO_ACTION_CLASS}
              >
                <Pencil className="size-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HeroStat label="Prospect Value" value={usd.format(prospectValue(company.company_size))} />
          <HeroStat label="Opportunities Value" value={usd.format(opportunitiesValue(company.company_size))} />
          <HeroStat label="Contacts" value={contacts.length.toLocaleString()} />
        </div>
      </HeroBand>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">
                Contacts <TabCount n={contacts.length} />
              </TabsTrigger>
              <TabsTrigger value="opportunities">
                Opportunities <TabCount n={opportunities.length} />
              </TabsTrigger>
              <TabsTrigger value="activity">
                Activity <TabCount n={activities.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CompanyOverviewForm
                companyId={companyId}
                accountId={accountId}
                canEdit={canEdit}
                defaults={company}
                editing={editing}
                onEditingChange={setEditing}
              />
            </TabsContent>

            <TabsContent value="contacts">
              {canEdit && (
                <div className="mb-4 flex justify-end">
                  <Button asChild size="sm">
                    <Link href={addContactHref}>
                      <Plus className="mr-1.5 size-4" />
                      Add Contact
                    </Link>
                  </Button>
                </div>
              )}
              {contacts.length === 0 ? (
                <p className="text-body text-neutral-500">No contacts at this company yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  <div className="hidden max-h-[560px] overflow-auto sm:block">
                    <Table>
                      <TableHeader variant="solid">
                        <TableRow className="border-b-0 hover:bg-transparent">
                          <TableHead variant="solid">Full Name</TableHead>
                          <TableHead variant="solid">Title</TableHead>
                          <TableHead variant="solid">Email</TableHead>
                          <TableHead variant="solid">Status</TableHead>
                          <TableHead variant="solid" className="text-right">
                            Last Activity
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="whitespace-nowrap font-medium text-neutral-800">
                              <Link href={`/contacts/${c.id}`} className="hover:text-primary-600 hover:underline">
                                {c.full_name}
                              </Link>
                            </TableCell>
                            <TableCell>{c.title ?? "—"}</TableCell>
                            <TableCell>{c.email}</TableCell>
                            <TableCell>{c.status && <StatusPill name={c.status.name} color={c.status.color} />}</TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums text-neutral-500">
                              {c.last_activity_at ? dayLabel(c.last_activity_at) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ul className="flex flex-col divide-y divide-neutral-100 sm:hidden">
                    {contacts.map((c) => (
                      <li key={c.id}>
                        <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-semibold text-neutral-800">{c.full_name}</p>
                            <p className="truncate text-caption text-neutral-500">
                              {[c.title, c.email].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {c.status && <StatusPill name={c.status.name} color={c.status.color} className="shrink-0" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="opportunities">
              {opportunities.length === 0 ? (
                <p className="text-body text-neutral-500">No opportunities at this company yet.</p>
              ) : (
                <ul className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto pr-1">
                  {opportunities.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/opportunities/${o.id}`}
                        className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3.5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_6px_16px_-8px_rgba(10,25,46,.18)]"
                      >
                        {o.stage && <span className={`h-10 w-1 shrink-0 rounded-full ${STAGE_STRIPE[o.stage.stage_group]}`} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-neutral-800">
                            {o.name || "Untitled opportunity"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            {o.stage && <Badge variant={STAGE_GROUP_BADGE_VARIANT[o.stage.stage_group]}>{o.stage.name}</Badge>}
                            {o.contact_name && <span className="text-caption font-medium text-neutral-700">{o.contact_name}</span>}
                            {o.owner_name && <span className="text-caption text-neutral-500">{o.owner_name}</span>}
                            <span className="text-caption tabular-nums text-neutral-400">
                              {daysSince(o.stage_entered_at) === "Today"
                                ? "Entered this stage today"
                                : `${daysSince(o.stage_entered_at)} in this stage`}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-h4 font-bold tabular-nums text-primary-900">
                            {o.stage?.win_probability ?? 0}%
                          </span>
                          <span className="block text-caption text-neutral-500">win probability</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="activity">
              <ActivityTimeline activities={activities} />
            </TabsContent>
          </Tabs>
        </div>

        {/* ---- Reference rail ---- */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="rounded-t-lg bg-primary-900 px-4 py-3">
              <h2 className="text-caption font-semibold uppercase tracking-wide text-white">Quick facts</h2>
            </div>
            <div className="flex flex-col gap-2.5 px-4 py-3.5">
              {company.phone && <Fact icon={Phone}>{company.phone}</Fact>}
              {fullAddress && <Fact icon={MapPin}>{fullAddress}</Fact>}
              {employees > 0 && <Fact icon={Users}>{employees.toLocaleString()} employees</Fact>}
              {company.industry && <Fact icon={Tag}>{company.industry}</Fact>}
              {!company.phone && !fullAddress && employees === 0 && !company.industry && (
                <p className="text-body-sm text-neutral-500">No details yet.</p>
              )}
            </div>
          </div>

          {(company.website || company.linkedin_url) && (
            <div className="rounded-lg border border-neutral-200 bg-white">
              <div className="rounded-t-lg bg-primary-900 px-4 py-3">
                <h2 className="text-caption font-semibold uppercase tracking-wide text-white">Links</h2>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3.5">
                {company.website && (
                  <LinkRow icon={Globe} href={company.website} label="Website" detail={hostnameOf(company.website)} />
                )}
                {company.linkedin_url && (
                  <LinkRow
                    icon={Link2}
                    href={company.linkedin_url}
                    label="Company LinkedIn"
                    detail={company.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, "").replace(/\/$/, "")}
                  />
                )}
              </div>
            </div>
          )}

          {byStatus.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white">
              <div className="rounded-t-lg bg-primary-900 px-4 py-3">
                <h2 className="text-caption font-semibold uppercase tracking-wide text-white">Contacts by Status</h2>
              </div>
              <ul className="flex flex-col gap-2 px-4 py-3.5">
                {byStatus.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <StatusPill name={s.name} color={s.color} />
                    <span className="text-body-sm font-semibold tabular-nums text-neutral-800">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
