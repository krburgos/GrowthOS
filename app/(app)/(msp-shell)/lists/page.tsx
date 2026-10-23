import { ListChecks, Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ListsBoard, type ListRow } from "@/components/lists/lists-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { usdShort } from "@/lib/companies/value";
import { getListRows } from "@/lib/lists/rows";
import { parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lists — GrowthMission" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.6, F1 — Lists Index.
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "CRM Pages
 * Refresh"): lists show as cards by default (Table one click away), each
 * with its contact count, a health bar of Active / Unsubscribed / Bounced
 * contacts, and its **Prospect Value**: the client's formula ($200 ×
 * Employees × 12) over the companies on the list, each company counted
 * once. A summary strip and search sit above. Rename, Upload contacts and
 * Delete (archive) are unchanged.
 *
 * Bounced is now real: a member counts as bounced if any campaign send to
 * them bounced (campaign_recipients.bounced_at), now that Campaigns exist.
 * Unsubscribed is contacts.email_opt_out, as before. Active is everyone
 * else on the list.
 *
 * The counts used to cost two queries per list; they are now three reads
 * for the whole page (lists, members with their contacts and companies,
 * and bounces), joined in JS. Sorting and the page slice still
 * happen in JS after the counts, as before.
 */
export default async function ListsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; pageSize?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const canEdit = EDIT_ROLES.includes(user.role);
  const supabase = await createClient();
  const { rows, contactIds, listedValue, unsubTotal } = await getListRows(supabase, user.account_id);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const { sort, dir, ...pageParams } = await searchParams;
  const ascending = dir ? dir !== "desc" : false;
  const { page, pageSize, from, to } = parsePagination(pageParams);
  const sortAccessors: Record<string, (l: ListRow) => string | number> = {
    name: (l) => l.name.toLowerCase(),
    contacts: (l) => l.memberCount,
    created_at: (l) => l.created_at,
    value: (l) => l.prospectValue,
    active: (l) => l.active,
    bounced: (l) => l.bounced,
    unsubscribed: (l) => l.unsubscribed,
  };
  const accessor = sortAccessors[sort ?? "created_at"] ?? sortAccessors.created_at;
  rows.sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av < bv) return ascending ? -1 : 1;
    if (av > bv) return ascending ? 1 : -1;
    return 0;
  });

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">Lists</h1>
          <p className="text-body text-neutral-500">Contacts you group by hand, for campaigns and follow-up.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/lists/upload">
                <Upload className="mr-1.5 size-4" />
                Upload List
              </Link>
            </Button>
            <Button asChild>
              <Link href="/lists/new">
                <Plus className="mr-1.5 size-4" />
                Create List
              </Link>
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Lists"
              value={rows.length.toLocaleString()}
              sub={`${rows.filter((l) => l.created_at >= monthStart).length} Added This Month`}
            />
            <Tile label="Contacts on a List" value={contactIds.length.toLocaleString()} sub="Each Counted Once" />
            <Tile
              label="Prospect Value on Lists"
              value={usdShort(listedValue)}
              sub={`${usdShort(listedValue * 3)} Opportunities Value`}
            />
            <Tile
              label="Unsubscribed"
              value={unsubTotal.toLocaleString()}
              sub={`${contactIds.length ? ((unsubTotal / contactIds.length) * 100).toFixed(1) : "0"}% of Listed Contacts`}
            />
          </div>

          <div>
            <ListsBoard lists={rows.slice(from, to + 1)} canEdit={canEdit} />
            <PaginationBar page={page} pageSize={pageSize} totalCount={rows.length} />
          </div>
        </>
      )}
    </main>
  );
}

function Tile({ label, tip, value, sub }: { label: string; tip?: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-primary-100 bg-white px-4 py-3 shadow-lift">
      <span className="flex items-center gap-1.5 text-caption text-neutral-500">
        {label}
        {tip && <InfoTip text={tip} label={`About ${label}`} />}
      </span>
      <span className="text-h3 font-bold tabular-nums text-primary-900">{value}</span>
      <span className="text-caption tabular-nums text-neutral-500">{sub}</span>
    </div>
  );
}
