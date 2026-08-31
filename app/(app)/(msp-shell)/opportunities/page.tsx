import { Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { KanbanBoard, type BoardOpportunity } from "@/components/opportunities/kanban-board";
import { OpportunityListTable, type OpportunityListRow } from "@/components/opportunities/opportunity-list-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { OpportunityStage } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities — GrowthOS" };

interface OpportunityQueryRow {
  id: string;
  stage: OpportunityStage;
  value: number | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
  companies: { name: string } | { name: string }[] | null;
}

/**
 * App Flow §4.5, E1/E2 — Opportunity Board (default) with a List view
 * toggle, server-driven via ?view=.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { view } = await searchParams;
  const isListView = view === "list";

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("opportunities")
    .select("id, stage, value, contacts(full_name), companies(name)")
    .eq("account_id", user.account_id)
    .order("created_at", { ascending: false });

  const opportunities = (rows ?? []).map((r) => {
    const row = r as unknown as OpportunityQueryRow;
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      id: row.id,
      stage: row.stage,
      value: row.value,
      contact_name: contact?.full_name ?? "Unknown",
      company_name: company?.name ?? null,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Opportunities</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-neutral-300 p-0.5">
            <Link
              href="/opportunities"
              className={cn(
                "rounded px-3 py-1 text-body-sm",
                !isListView ? "bg-primary-700 text-white" : "text-neutral-600"
              )}
            >
              Board
            </Link>
            <Link
              href="/opportunities?view=list"
              className={cn(
                "rounded px-3 py-1 text-body-sm",
                isListView ? "bg-primary-700 text-white" : "text-neutral-600"
              )}
            >
              List
            </Link>
          </div>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState icon={Target} />
      ) : isListView ? (
        <OpportunityListTable opportunities={opportunities as OpportunityListRow[]} />
      ) : (
        <KanbanBoard opportunities={opportunities as BoardOpportunity[]} />
      )}
    </main>
  );
}
