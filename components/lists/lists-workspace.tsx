"use client";

import { ArrowRight, Plus, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MissionSteps } from "@/components/growth-mission/mission-steps";
import { BuildIcpListDialog } from "@/components/lists/build-icp-list-dialog";
import { Health } from "@/components/lists/lists-table";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { InfoTip } from "@/components/ui/info-tip";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { SortHeading, useTableSort } from "@/components/ui/sort-heading";
import { usd } from "@/lib/companies/value";
import type { ListsCard, ListsCardRow } from "@/lib/icp/queries";
import type { IcpAnswers } from "@/lib/vision-board/icp";
import { cn } from "@/lib/utils";

const COLS = "grid grid-cols-[minmax(220px,1fr)_96px_96px_140px_130px_minmax(200px,1fr)_96px] items-center gap-x-4";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";

const added = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fitText = (r: ListsCardRow) => (r.icpFit === null ? "—" : `${Math.round(r.icpFit * 100)}%`);

/**
 * Lists on the List Building Mission Card (client-confirmed, 2026-10-23,
 * approved mockup "ICP & List Building Cards"): the account's lists with
 * how much of each fits the ICP and who is working it, the card's mission
 * steps, and Build ICP list. Build ICP list is never locked; while the ICP
 * is unfinished or not approved by both sides, a warning says so.
 */
export function ListsWorkspace({
  card,
  icp,
  icpReady,
  accountId,
  canEdit,
  focusSlot,
}: {
  card: ListsCard;
  icp: IcpAnswers;
  /** The ICP is complete and approved by both an MSP Owner and a CRO Admin. */
  icpReady: boolean;
  accountId: string;
  canEdit: boolean;
  focusSlot?: React.ReactNode;
}) {
  const [building, setBuilding] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { sorted, headingFor } = useTableSort(
    card.rows,
    {
      name: (r) => r.name.toLowerCase(),
      fit: (r) => r.icpFit ?? -1,
      contacts: (r) => r.memberCount,
      value: (r) => r.prospectValue,
      added: (r) => r.created_at,
    },
    { key: "added" as "name" | "fit" | "contacts" | "value" | "added", dir: "desc" }
  );
  const shown = sorted.slice((page - 1) * pageSize, page * pageSize);

  const icpRows = card.rows.filter((r) => r.built_from_icp);
  const fitPct = card.distinctContacts ? Math.round((card.fitContacts / card.distinctContacts) * 100) : 0;

  return (
    <section id="lists" className="scroll-mt-6 overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">Lists</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {card.rows.length} {card.rows.length === 1 ? "list" : "lists"} · {card.distinctContacts.toLocaleString()} contacts ·{" "}
            {card.icpLists} ICP {card.icpLists === 1 ? "list" : "lists"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {focusSlot}
          {canEdit && (
            <>
              <Link
                href="/lists/new"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-body-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Plus className="size-4" />
                New list
              </Link>
              <button
                type="button"
                onClick={() => setBuilding(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3.5 text-body-sm font-semibold text-primary-900 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
              >
                <Target className="size-4" />
                Build ICP list
              </button>
            </>
          )}
        </div>
      </div>

      {!icpReady && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning-300 bg-warning-100 px-5 py-2.5 text-body-sm text-warning-900">
          <TriangleAlert className="size-4 shrink-0 text-warning-800" aria-hidden="true" />
          <span className="font-semibold">Your ICP isn&apos;t finished yet.</span>
          <span>Lists built now may target the wrong companies.</span>
          <Link href="/growth-mission/icp-development" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary-900 hover:underline">
            Finish the ICP
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <MissionSteps
        steps={[
          { label: "ICP approved", done: icpReady, href: "/growth-mission/icp-development", hrefLabel: "View" },
          {
            label: "Build an ICP list",
            done: card.icpLists > 0,
            tip: "Build ICP list puts every contact that matches your ICP on a new list. Import a file or add contacts by hand for anything the CRM doesn't have yet.",
          },
          {
            label: "Clean it",
            done: card.icpLists > 0 && card.toClean === 0,
            tip: "Take bounced and unsubscribed contacts off your ICP lists, and fill in missing titles and company sizes, before anyone calls or emails them.",
          },
          {
            label: "Put it to work",
            done: icpRows.length > 0 && icpRows.every((r) => r.workingIt.length > 0),
            tip: "Assign each ICP list to an SDR for calling, or send it a campaign. A list nobody is working shows Not used.",
          },
        ]}
      />

      <div className="grid grid-cols-2 border-b border-primary-200 bg-primary-50 lg:grid-cols-4 lg:divide-x lg:divide-primary-200">
        <Stat label="Contacts on lists" value={card.distinctContacts.toLocaleString()} />
        <Stat label="Fit the ICP" value={card.fitContacts.toLocaleString()} sub={`${fitPct}%`} />
        <Stat
          label="To clean"
          value={card.toClean.toLocaleString()}
          tip="Bounced and unsubscribed contacts on your ICP lists."
        />
        <Stat label="Lists not in use" value={card.unused.toLocaleString()} />
      </div>

      {card.rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-500">
          No lists yet{canEdit ? ". Use Build ICP list to make your first one." : "."}
        </p>
      ) : (
        <>
          {/* Below lg each list is a card, like the Campaigns section. */}
          <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
            {shown.map((r) => (
              <article key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/lists/${r.id}`} className="min-w-0 truncate text-body-sm font-semibold text-neutral-900 hover:underline">
                    {r.name}
                    {r.built_from_icp && <IcpChip />}
                  </Link>
                  <span className="shrink-0 text-body-sm font-semibold tabular-nums text-primary-900">{fitText(r)} fit</span>
                </div>
                <Health list={r} className="mt-2.5" />
                <p className="mt-2 text-caption tabular-nums text-neutral-500">
                  {r.memberCount.toLocaleString()} contacts · {usd.format(r.prospectValue)} · {added(r.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Working items={r.workingIt} />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[1080px]">
              <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                <span>
                  <SortHeading label="List" {...headingFor("name")} />
                </span>
                <span className="text-right">
                  <SortHeading label="ICP fit" {...headingFor("fit")} />
                </span>
                <span className="text-right">
                  <SortHeading label="Contacts" {...headingFor("contacts")} />
                </span>
                <span className="text-right">
                  <SortHeading label="Prospect Value" {...headingFor("value")} />
                </span>
                <span>Health</span>
                <span>Working it</span>
                <span>
                  <SortHeading label="Added" {...headingFor("added")} />
                </span>
              </div>
              {shown.map((r) => (
                <div key={r.id} className={`${COLS} min-h-[58px] border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70`}>
                  <span className="flex min-w-0 items-center">
                    <Link href={`/lists/${r.id}`} title={r.name} className="truncate text-body-sm font-semibold text-neutral-900 hover:underline">
                      {r.name}
                    </Link>
                    {r.built_from_icp && <IcpChip />}
                  </span>
                  <span className={cn("text-right text-body-sm font-semibold tabular-nums", r.icpFit === 1 ? "text-primary-900" : "text-neutral-600")}>
                    {fitText(r)}
                  </span>
                  <span className="text-right text-body-sm font-semibold tabular-nums text-neutral-800">{r.memberCount.toLocaleString()}</span>
                  <span className="text-right text-body-sm font-semibold tabular-nums text-primary-900">{usd.format(r.prospectValue)}</span>
                  <Health list={r} className="w-28" />
                  <span className="flex flex-wrap gap-1.5">
                    <Working items={r.workingIt} />
                  </span>
                  <span className="text-body-sm tabular-nums text-neutral-500">{added(r.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-200 bg-primary-50 px-4">
            <LocalPaginationBar
              page={page}
              pageSize={pageSize}
              totalCount={card.rows.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
            <Link href="/lists" className="inline-flex items-center gap-1 py-2 text-body-sm font-semibold text-secondary-700 hover:underline">
              Open all lists
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </>
      )}

      {canEdit && <BuildIcpListDialog open={building} onOpenChange={setBuilding} accountId={accountId} icp={icp} />}
    </section>
  );
}

function Stat({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3.5">
      <span className="flex items-center gap-1.5 text-caption text-primary-700">
        {label}
        {tip && <InfoTip text={tip} label={`About ${label}`} />}
      </span>
      <span className="text-h3 font-bold tabular-nums text-primary-900">
        {value} {sub && <span className="text-body font-medium text-primary-700">{sub}</span>}
      </span>
    </div>
  );
}

function IcpChip() {
  return <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-secondary-100 px-2 py-px text-[11px] font-bold text-secondary-800">ICP</span>;
}

function Working({ items }: { items: ListsCardRow["workingIt"] }) {
  if (items.length === 0) {
    return <span className="inline-flex items-center rounded-full bg-warning-100 px-2.5 py-0.5 text-caption font-semibold text-warning-800">Not used</span>;
  }
  return (
    <>
      {items.map((w, i) => (
        <span key={i} className="inline-flex max-w-full items-center truncate rounded-full bg-primary-100 px-2.5 py-0.5 text-caption font-semibold text-primary-900">
          {w.kind === "sdr" ? "SDR" : "Campaign"} · {w.label}
        </span>
      ))}
    </>
  );
}
