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
 */
export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, website, linkedin_url, industry, company_size, phone, address_line1, city, state")
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
      .select("id, name, value, contacts(full_name), opportunity_stages(name, stage_group)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-8">
      <h1 className="text-h1 text-primary-900">{company.name}</h1>

      <CompanyOverviewForm companyId={company.id} accountId={user.account_id!} canEdit={canEdit} defaults={company} />

      <div className="rounded-lg border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 px-6 py-4 text-h4 text-primary-900">
          Contacts <span className="text-body text-neutral-400">({contacts?.length ?? 0})</span>
        </h2>
        {contacts && contacts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
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

      <div className="rounded-lg border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 px-6 py-4 text-h4 text-primary-900">
          Opportunities <span className="text-body text-neutral-400">({opportunities?.length ?? 0})</span>
        </h2>
        {opportunities && opportunities.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
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
