"use client";

import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { CampaignRow } from "@/components/campaigns/campaigns-table";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { cn } from "@/lib/utils";

type Show = "all" | "draft" | "scheduled" | "sent";

const STATUS_BADGE: Record<CampaignRow["status"], "neutral" | "info" | "success" | "error"> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  sent: "success",
  failed: "error",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<CampaignRow["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

const COLS = "grid grid-cols-[minmax(260px,1fr)_120px_110px_160px_160px_130px] items-center gap-x-4";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";

function RateMeter({ rate, tone }: { rate: number | null; tone: "open" | "click" }) {
  if (rate == null) return <span className="text-right text-body-sm text-neutral-300">—</span>;
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
        <span
          className={cn("block h-full rounded-full", tone === "open" ? "bg-secondary-500" : "bg-success-500")}
          style={{ width: `${Math.min(rate * 100, 100)}%` }}
        />
      </span>
      <span className="inline-block w-12 text-right text-body-sm font-semibold tabular-nums text-neutral-800">
        {(rate * 100).toFixed(1)}%
      </span>
    </span>
  );
}

const dateOf = (c: CampaignRow) =>
  c.dateLabel === "Created"
    ? "Not sent"
    : new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * Campaigns on the Email Campaigning Mission Card (client-confirmed,
 * 2026-10-22, approved mockup "Mission Card Workspaces"). Campaigns moved
 * here from its own sidebar page; composing, scheduling and each
 * campaign's detail page are unchanged. Same blue frame as Mission Orders
 * and the Arsenal: navy title bar, the four figures on light blue, a light
 * blue filter row and column headings, white rows.
 */
export function CampaignsWorkspace({
  campaigns,
  canEdit,
  focusSlot,
}: {
  campaigns: CampaignRow[];
  canEdit: boolean;
  /** The Mission Card's Focus button. */
  focusSlot?: React.ReactNode;
}) {
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sent = campaigns.filter((c) => c.status === "sent");
  const count = (s: Show) => (s === "all" ? campaigns.length : campaigns.filter((c) => c.status === s).length);
  const avg = (rate: (c: CampaignRow) => number | null) =>
    sent.length > 0 ? sent.reduce((sum, c) => sum + (rate(c) ?? 0), 0) / sent.length : 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (show === "all" || c.status === show) &&
        (!q || c.name.toLowerCase().includes(q) || c.listName.toLowerCase().includes(q))
    );
  }, [campaigns, show, query]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);

  const stats = [
    { label: "Campaigns sent", value: String(sent.length) },
    { label: "Avg. open rate", value: `${(avg((c) => c.openRate) * 100).toFixed(1)}%` },
    { label: "Avg. click rate", value: `${(avg((c) => c.clickRate) * 100).toFixed(1)}%` },
    { label: "Scheduled", value: String(count("scheduled")) },
  ];

  const pill = (value: Show, label: string) => (
    <button
      type="button"
      aria-pressed={show === value}
      onClick={() => {
        setShow(value);
        setPage(1);
      }}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 motion-reduce:transition-none",
        show === value ? "border-primary-700 bg-primary-50 text-primary-900" : "border-neutral-300 bg-white text-neutral-500 hover:text-primary-900"
      )}
    >
      {label} {count(value)}
    </button>
  );

  return (
    <section id="campaigns" className="scroll-mt-6 overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">Campaigns</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {campaigns.length === 0
              ? "No campaigns yet."
              : `${sent.length} sent · ${count("scheduled")} scheduled · ${count("draft")} ${count("draft") === 1 ? "draft" : "drafts"}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {focusSlot}
          {canEdit && (
            <Button size="sm" variant="secondary" className="border-transparent hover:border-transparent" asChild>
              <Link href="/campaigns/new">
                <Plus className="mr-1.5 size-4" />
                New Campaign
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-primary-200 bg-primary-50 sm:grid-cols-4 sm:divide-x sm:divide-primary-200">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="text-caption text-primary-700">{s.label}</span>
            <span className="text-h3 font-bold tabular-nums text-primary-900">{s.value}</span>
          </div>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          No campaigns yet{canEdit ? ". Use New Campaign to send one to a list." : "."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
            <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
              <Filter className="size-4 text-secondary-700" aria-hidden="true" />
              Filter
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700">Status</span>
              <div className="flex flex-wrap gap-1">
                {pill("all", "All")}
                {pill("draft", "Drafts")}
                {pill("scheduled", "Scheduled")}
                {pill("sent", "Sent")}
              </div>
            </div>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700">Search</span>
              <span className="flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
                <Search className="size-3.5 shrink-0 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Campaign or list"
                  className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                />
              </span>
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-neutral-500">No campaigns match these filters.</p>
          ) : (
            <>
              {/* Below lg each campaign is a card, like the Arsenal's files. */}
              <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
                {shown.map((c) => (
                  <article key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/campaigns/${c.id}`} className="block truncate text-body-sm font-semibold text-neutral-900 hover:underline">
                          {c.name}
                        </Link>
                        <p className="truncate text-caption text-neutral-400">{c.listName}</p>
                      </div>
                      <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    </div>
                    <p className="mt-2 text-caption tabular-nums text-neutral-500">
                      {c.recipients || "No"} recipients
                      {c.openRate != null && ` · ${(c.openRate * 100).toFixed(1)}% opened`}
                      {c.clickRate != null && ` · ${(c.clickRate * 100).toFixed(1)}% clicked`} · {dateOf(c)}
                    </p>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <div className="min-w-[960px]">
                  <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                    <span>Campaign</span>
                    <span>Status</span>
                    <span className="text-right">Recipients</span>
                    <span className="text-right">Open rate</span>
                    <span className="text-right">Click rate</span>
                    <span className="text-right">Date</span>
                  </div>
                  {shown.map((c) => (
                    <div key={c.id} className={`${COLS} min-h-[58px] border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70`}>
                      <span className="min-w-0">
                        <Link
                          href={`/campaigns/${c.id}`}
                          title={c.name}
                          className="block truncate text-body-sm font-semibold text-neutral-900 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="block truncate text-caption text-neutral-400">{c.listName}</span>
                      </span>
                      <span>
                        <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      </span>
                      <span className="text-right text-body-sm tabular-nums text-neutral-700">{c.recipients || "—"}</span>
                      <RateMeter rate={c.openRate} tone="open" />
                      <RateMeter rate={c.clickRate} tone="click" />
                      <span className="text-right text-body-sm tabular-nums text-neutral-500">{dateOf(c)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-primary-200 bg-primary-50 px-4">
                <LocalPaginationBar
                  page={page}
                  pageSize={pageSize}
                  totalCount={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
