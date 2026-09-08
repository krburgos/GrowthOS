import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyOverviewForm } from "@/components/companies/company-overview-form";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Client-confirmed addition (2026-09-08) — Company Detail. Reuses the
 * exact field set from Contact Detail's Company card (Design System
 * §8.5) in its own record, plus every contact and opportunity linked
 * to this company (`contacts`/`opportunities` both carry `company_id`
 * directly — no join table involved). "Merge with another company"
 * lives here now, not on Contact Detail.
 *
 * Client-confirmed redesign ("Concept B — Gradient hero, single
 * scroll", 2026-09-08): the plain `<h1>` is gone — the hero inside
 * `CompanyOverviewForm` carries the name now. A stat row (Contacts,
 * Open Pipeline, Opportunities) sits between the hero and the field
 * grid, computed here from data this page already fetches (no new
 * queries). Contacts/Opportunities below now use the shared `Table`'s
 * `variant="solid"` navy header, matching every other table in the
 * app since the modernization pass — they'd been left on the plain
 * neutral-50 header since this page was first built.
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

  const [{ data: contacts }, { data: opportunities }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, title, email, contact_statuses(name)")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("opportunities")
      .select("id, name, value, stage_id, contacts(full_name), opportunity_stages(name, stage_group)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const openPipeline = (opportunities ?? [])
    .filter((o) => {
      const stage = Array.isArray(o.opportunity_stages) ? o.opportunity_stages[0] : o.opportunity_stages;
      return stage?.stage_group === "open";
    })
    .reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-8">
      <CompanyOverviewForm companyId={company.id} accountId={user.account_id!} canEdit={canEdit} defaults={company} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-primary-900">{contacts?.length ?? 0}</p>
          <p className="text-caption text-neutral-500">Contacts</p>
        </div>
        <div className="rounded-lg border border-secondary-100 bg-gradient-to-br from-secondary-50 to-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-secondary-800">{currency.format(openPipeline)}</p>
          <p className="text-caption text-neutral-500">Open Pipeline</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-primary-900">{opportunities?.length ?? 0}</p>
          <p className="text-caption text-neutral-500">Opportunities</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 px-6 py-4 text-h4 text-primary-900">
          Contacts <span className="text-body text-neutral-400">({contacts?.length ?? 0})</span>
        </h2>
        {contacts && contacts.length > 0 ? (
          <Table>
            <TableHeader variant="solid">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead variant="solid">Name</TableHead>
                <TableHead variant="solid">Title</TableHead>
                <TableHead variant="solid">Email</TableHead>
                <TableHead variant="solid">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => {
                const status = Array.isArray(c.contact_statuses) ? c.contact_statuses[0] : c.contact_statuses;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-neutral-800">
                      <Link href={`/contacts/${c.id}`}>{c.full_name}</Link>
                    </TableCell>
                    <TableCell>{c.title ?? "—"}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{status && <Badge variant="neutral">{status.name}</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="px-6 py-6 text-body text-neutral-500">No contacts at this company yet.</p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 px-6 py-4 text-h4 text-primary-900">
          Opportunities <span className="text-body text-neutral-400">({opportunities?.length ?? 0})</span>
        </h2>
        {opportunities && opportunities.length > 0 ? (
          <Table>
            <TableHeader variant="solid">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead variant="solid">Contact</TableHead>
                <TableHead variant="solid">Stage</TableHead>
                <TableHead variant="solid">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => {
                const contact = Array.isArray(o.contacts) ? o.contacts[0] : o.contacts;
                const stage = Array.isArray(o.opportunity_stages) ? o.opportunity_stages[0] : o.opportunity_stages;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium text-neutral-800">
                      <Link href={`/opportunities/${o.id}`}>{contact?.full_name ?? "—"}</Link>
                    </TableCell>
                    <TableCell>
                      {stage && (
                        <Badge variant={STAGE_GROUP_BADGE_VARIANT[stage.stage_group as StageGroup]}>{stage.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{o.value != null ? currency.format(o.value) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="px-6 py-6 text-body text-neutral-500">No opportunities at this company yet.</p>
        )}
      </div>
    </main>
  );
}
