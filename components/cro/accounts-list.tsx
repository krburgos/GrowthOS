"use client";

import { Check, Minus } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHours, paceTone, quarterPct, type QuarterInfo } from "@/lib/gos-dashboard/hours";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export interface CroAccountRow {
  id: string;
  name: string;
  website: string | null;
  questionnaireComplete: boolean;
  visionBoardComplete: boolean;
  committedHours: number;
  achievedHours: number;
  lastActivityAt: string | null;
  /** No activity in over 14 days (or none at all) — computed server-side so the label and filter agree. */
  idle: boolean;
}

function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function DoneMark({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${done ? "complete" : "not complete"}`}
      className={cn(
        "flex size-[22px] items-center justify-center rounded-full",
        done ? "bg-success-100 text-success-700" : "bg-neutral-100 text-neutral-400"
      )}
    >
      {done ? <Check className="size-3" strokeWidth={2.5} /> : <Minus className="size-3" strokeWidth={2.5} />}
      <span className="sr-only">{done ? `${label} complete` : `${label} not complete`}</span>
    </span>
  );
}

function lastActivityLabel(iso: string | null) {
  if (!iso) return "No activity yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * App Flow §4.10 (J1) — the CRO Leader Dashboard's account search/enter list.
 * Client-side filter, matching the same pattern as Lists Index/Companies List.
 *
 * Pagination (2026-09-15): the filter is client-side, so the page also slices
 * client-side via `LocalPaginationBar` rather than the URL-driven
 * `PaginationBar` -- this list and the Partners list below it share one page,
 * and both can't own the URL's `page`/`pageSize` params at once.
 *
 * Client-confirmed redesign (2026-09-17), "rows": each account now carries its
 * own status — the two documents, this quarter's hours, and how long since any
 * activity — so a stalled account is visible without entering it. "Needs
 * attention" narrows to accounts missing a document, behind the quarter's
 * pace, or idle for over 14 days.
 */
export function AccountsList({ accounts, quarter }: { accounts: CroAccountRow[]; quarter: QuarterInfo }) {
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const needsAttention = (a: CroAccountRow) =>
    !a.questionnaireComplete ||
    !a.visionBoardComplete ||
    a.idle ||
    (a.committedHours > 0 && quarterPct(a2h(a)) < quarter.elapsedPct - 20);

  const filtered = accounts.filter(
    (a) => a.name.toLowerCase().includes(query.trim().toLowerCase()) && (!attentionOnly || needsAttention(a))
  );
  const attentionCount = accounts.filter(needsAttention).length;
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          placeholder="Search accounts…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <button
          type="button"
          aria-pressed={attentionOnly}
          onClick={() => {
            setAttentionOnly((v) => !v);
            setPage(1);
          }}
          className={cn(
            "rounded-md border px-3 py-2 text-body-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
            attentionOnly
              ? "border-warning-700 bg-warning-100 text-warning-800"
              : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
          )}
        >
          Needs attention ({attentionCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-body text-neutral-500">
          {accounts.length === 0
            ? "No accounts yet."
            : attentionOnly
              ? "Every account is on track."
              : "No accounts match your search."}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader variant="solid">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead variant="solid">Account</TableHead>
                <TableHead variant="solid">GOS Solution Questionnaire</TableHead>
                <TableHead variant="solid">GOS Vision Board</TableHead>
                <TableHead variant="solid">Hours this quarter</TableHead>
                <TableHead variant="solid">Last activity</TableHead>
                <TableHead variant="solid" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((a) => {
                const pct = quarterPct(a2h(a));
                const tone = paceTone(pct, quarter.elapsedPct);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary-800 to-secondary-700 text-caption font-bold text-white">
                          {initials(a.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-800">{a.name}</span>
                          {a.website && <span className="block truncate text-caption text-secondary-700">{a.website}</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DoneMark done={a.questionnaireComplete} label="GrowthOS Solution Questionnaire" />
                    </TableCell>
                    <TableCell>
                      <DoneMark done={a.visionBoardComplete} label="GrowthOS Vision Board" />
                    </TableCell>
                    <TableCell>
                      {a.committedHours > 0 ? (
                        <div className="flex min-w-[130px] flex-col gap-1">
                          <span className="text-caption tabular-nums text-neutral-600">
                            {formatHours(a.achievedHours)} / {formatHours(a.committedHours)} hrs · {pct}%
                          </span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                tone === "over" ? "bg-success-600" : tone === "behind" ? "bg-warning-400" : "bg-secondary-500"
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </span>
                        </div>
                      ) : (
                        <span className="text-caption text-neutral-400">No hours set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-body-sm", a.idle ? "text-neutral-400" : "text-neutral-600")}>
                        {lastActivityLabel(a.lastActivityAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <form action="/api/cro/enter" method="post" className="flex justify-end">
                        <input type="hidden" name="accountId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-caption font-semibold text-primary-700 transition-colors hover:border-primary-700"
                        >
                          Enter →
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <LocalPaginationBar
            page={page}
            pageSize={pageSize}
            totalCount={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}

function a2h(a: CroAccountRow) {
  return { committed: a.committedHours, achieved: a.achievedHours };
}
