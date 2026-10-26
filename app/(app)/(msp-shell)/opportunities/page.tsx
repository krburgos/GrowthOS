import { Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { KanbanBoard, type BoardOpportunity } from "@/components/opportunities/kanban-board";
import { NewOpportunityButton } from "@/components/opportunities/new-opportunity-panel";
import { OpportunityListTable, type OpportunityListRow } from "@/components/opportunities/opportunity-list-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { employeesOf, prospectValue, usdShort } from "@/lib/companies/value";
import { currentQuarter } from "@/lib/growth-mission/hours";
import type { OpportunityStageRow, StageGroup } from "@/lib/opportunities/stages";
import { parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities — GrowthMission" };

interface OpportunityQueryRow {
  id: string;
  name: string | null;
  type: string | null;
  stage_id: string;
  owner_id: string | null;
  closed_at: string | null;
  stage_entered_at: string;
  contacts: { full_name: string } | { full_name: string }[] | null;
  companies: { name: string; company_size: string | null } | { name: string; company_size: string | null }[] | null;
  users: { full_name: string } | { full_name: string }[] | null;
  opportunity_stages:
    | { name: string; stage_group: StageGroup; win_probability: number }
    | { name: string; stage_group: StageGroup; win_probability: number }[]
    | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Who may edit in the List view: the opportunities_update policy's roles. */
const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.5, E1/E2 — Opportunity Board (default) with a List view
 * toggle, server-driven via ?view=. Columns are the account's own
 * opportunity_stages rows.
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "CRM Pages
 * Refresh"): no "pipeline" anywhere. Every value here is the client's
 * company-size formula (lib/companies/value.ts): Prospect Value = $200 ×
 * the company's Employees × 12, Opportunities Value = 3 × that. The
 * opportunity's own typed Value field appears only on the opportunity's
 * page and in Reports' Revenue from Closed-Won. Cards and rows show how
 * long each opportunity has been in its stage (opportunities.
 * stage_entered_at, recorded from 2026-10-14).
 *
 * The summary strip sits on the page rather than inside the board so
 * Board and List share it. Pagination (2026-09-15) applies only to List.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  /** `new=1` opens the New Opportunity panel; old /opportunities/new links land here with it. */
  searchParams: Promise<{ view?: string; page?: string; pageSize?: string; sort?: string; dir?: string; new?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { view, sort, dir, new: openNew, ...pageParams } = await searchParams;
  const isListView = view === "list";
  const { page, pageSize, from, to } = parsePagination(pageParams);

  const supabase = await createClient();
  const [{ data: rows }, { data: stageRows }, { data: ownerRows }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, name, type, stage_id, owner_id, closed_at, stage_entered_at, contacts(full_name), companies(name, company_size), users(full_name), opportunity_stages(name, stage_group, win_probability)"
      )
      .eq("account_id", user.account_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order, win_probability")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    // The List view's inline Salesperson choice (2026-10-26).
    supabase.from("users").select("id, full_name").eq("account_id", user.account_id).is("archived_at", null).order("full_name"),
  ]);

  const stages = (stageRows ?? []) as OpportunityStageRow[];
  const stageOrder = new Map(stages.map((s) => [s.id, s.sort_order]));

  const opportunities = (rows ?? []).map((r) => {
    const row = r as unknown as OpportunityQueryRow;
    const contact = one(row.contacts);
    const company = one(row.companies);
    const owner = one(row.users);
    const stage = one(row.opportunity_stages);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      stage_id: row.stage_id,
      stage_name: stage?.name ?? "Unknown",
      stage_group: stage?.stage_group ?? "open",
      win_probability: stage?.win_probability ?? 0,
      closed_at: row.closed_at,
      stage_entered_at: row.stage_entered_at,
      contact_name: contact?.full_name ?? "Unknown",
      company_name: company?.name ?? null,
      employees: employeesOf(company?.company_size),
      prospect_value: prospectValue(company?.company_size),
      owner_id: row.owner_id,
      owner_name: owner?.full_name ?? null,
    };
  });

  // ---- Summary strip ----
  const q = currentQuarter();
  const open = opportunities.filter((o) => o.stage_group === "open");
  const openValue = open.reduce((s, o) => s + o.prospect_value, 0);
  const wonThisQuarter = opportunities.filter(
    (o) => o.stage_group === "won" && o.closed_at && o.closed_at.slice(0, 10) >= q.start && o.closed_at.slice(0, 10) < q.nextStart
  );
  const average = opportunities.length > 0 ? opportunities.reduce((s, o) => s + o.prospect_value, 0) / opportunities.length : 0;

  // ---- List view sort (server-driven via SortableHeader) ----
  // Every column sorts (client-confirmed, 2026-10-26). A missing company or
  // salesperson sorts last whichever way the column is turned.
  const direction = dir === "desc" ? -1 : 1;
  const byText = (x: string | null, y: string | null) =>
    x === y ? 0 : x === null ? 1 : y === null ? -1 : direction * x.localeCompare(y, undefined, { sensitivity: "base" });
  const listRows = [...opportunities].sort((a, b) => {
    switch (sort) {
      case "contact":
        return direction * (a.name ?? a.contact_name).localeCompare(b.name ?? b.contact_name);
      case "type":
        return byText(a.type, b.type);
      case "company":
        return byText(a.company_name, b.company_name);
      case "employees":
        return direction * (a.employees - b.employees);
      case "stage":
        return direction * ((stageOrder.get(a.stage_id) ?? 0) - (stageOrder.get(b.stage_id) ?? 0));
      case "value":
      case "opps_value":
        // Opportunities Value is 3 × Prospect Value, so the same order.
        return direction * (a.prospect_value - b.prospect_value);
      case "win":
        return direction * (a.win_probability - b.win_probability);
      case "salesperson":
        return byText(a.owner_name, b.owner_name);
      case "days":
        return direction * (new Date(a.stage_entered_at).getTime() - new Date(b.stage_entered_at).getTime());
      default:
        return 0;
    }
  });

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">Opportunities</h1>
          <p className="text-body text-neutral-500">
            {isListView ? "Every opportunity as a row." : "Drag a card to move it to another stage."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-1 shadow-inner">
            {[
              { href: "/opportunities", label: "Board", on: !isListView },
              { href: "/opportunities?view=list", label: "List", on: isListView },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={cn(
                  "rounded px-3 py-1 text-body-sm font-medium transition-colors",
                  t.on ? "bg-white text-primary-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {/* Client-confirmed (2026-10-20, approved mockup "New Opportunity
              Panel"): a side panel here, rather than a page that needed a contact. */}
          <NewOpportunityButton accountId={user.account_id!} defaultOpen={openNew === "1"} />
        </div>
      </div>

      {opportunities.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Prospects Value"
            value={usdShort(openValue)}
            sub={`${open.length} Open ${open.length === 1 ? "Opportunity" : "Opportunities"}`}
          />
          <Tile
            label="Opportunities Value"
            value={usdShort(openValue * 3)}
            sub={`${open.length} Open ${open.length === 1 ? "Opportunity" : "Opportunities"}`}
          />
          <Tile
            label="Won This Quarter"
            value={String(wonThisQuarter.length)}
            sub={`${usdShort(wonThisQuarter.reduce((s, o) => s + o.prospect_value, 0))} Prospect Value`}
          />
          <Tile
            label="Average Prospect Value"
            value={usdShort(Math.round(average))}
            sub={`${opportunities.length} ${opportunities.length === 1 ? "Opportunity" : "Opportunities"}`}
          />
        </div>
      )}

      {opportunities.length === 0 ? (
        <EmptyState icon={Target} />
      ) : isListView ? (
        <div>
          <OpportunityListTable
            opportunities={listRows.slice(from, to + 1) as OpportunityListRow[]}
            stages={stages}
            owners={(ownerRows ?? []) as { id: string; full_name: string }[]}
            canEdit={CAN_EDIT_ROLES.includes(user.role)}
            accountId={user.account_id!}
          />
          <PaginationBar page={page} pageSize={pageSize} totalCount={opportunities.length} />
        </div>
      ) : (
        <KanbanBoard stages={stages} opportunities={opportunities as BoardOpportunity[]} />
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
