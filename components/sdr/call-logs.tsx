"use client";

import { Download, Filter, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALL_OUTCOME_STYLE, OUTCOME_ORDER } from "@/lib/sdr/call-style";
import { CONNECTED_OUTCOMES, OUTCOME_LABEL, dateKey, type CallOutcome } from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type When = "today" | "week" | "month" | "quarter" | "30" | "custom";
const WHEN_LABEL: Record<When, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  "30": "Last 30 days",
  custom: "Custom range…",
};
const ANY = "__any";
const COLS = "grid grid-cols-[150px_140px_minmax(220px,1.3fr)_minmax(180px,1fr)_140px_minmax(200px,1.2fr)] items-center gap-x-4";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";
const LABEL = "text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700";
const LIMIT = 2000;

interface CallRow {
  id: string;
  occurred_at: string;
  user_id: string | null;
  call_outcome: CallOutcome | null;
  subject: string | null;
  body: string | null;
  contact_id: string | null;
  contacts: { full_name: string; title: string | null; companies: { name: string } | null } | null;
}

/** [from, to) for a preset, in the viewer's own timezone. */
function rangeFor(when: When, from: string, to: string): [Date, Date] | null {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (when === "today") return [start, end];
  if (when === "week") {
    const s = new Date(start);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return [s, end];
  }
  if (when === "month") return [new Date(now.getFullYear(), now.getMonth(), 1), end];
  if (when === "quarter") return [new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), end];
  if (when === "30") {
    const s = new Date(start);
    s.setDate(s.getDate() - 29);
    return [s, end];
  }
  if (!from || !to || to < from) return null;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return [new Date(fy, fm - 1, fd), new Date(ty, tm - 1, td + 1)];
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** "Bad number · Direct" keeps which number in the subject; show it in the note line. */
function noteOf(c: CallRow): string {
  const which = c.call_outcome === "bad_number" ? c.subject?.split(" · ")[2] : undefined;
  return [which, c.body?.trim()].filter(Boolean).join(" · ");
}

/**
 * Call Logs on the SDR Outreach Mission Card (client-confirmed, 2026-11-02,
 * approved mockup "Call Logs and Scrub List Mockup"): every call logged on
 * the account, filtered by date, SDR, outcome and list, with the outcome
 * summary for whatever is shown. Someone who may only see their own queue
 * sees only their own calls. Reads straight from Supabase under RLS.
 */
export function CallLogs({
  accountId,
  viewerId,
  canViewAny,
  people,
  lists,
  focusSlot,
}: {
  accountId: string;
  viewerId: string;
  canViewAny: boolean;
  people: { id: string; full_name: string }[];
  lists: { id: string; name: string }[];
  focusSlot?: ReactNode;
}) {
  const [when, setWhen] = useState<When>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sdr, setSdr] = useState(canViewAny ? "" : viewerId);
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [listId, setListId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  // The chosen list's members, kept with the list they belong to.
  const [loadedList, setLoadedList] = useState<{ listId: string; ids: Set<string> } | null>(null);
  const inList = listId && loadedList?.listId === listId ? loadedList.ids : null;
  const [error, setError] = useState(false);

  const range = rangeFor(when, from, to);
  const rangeKey = range ? `${range[0].toISOString()}|${range[1].toISOString()}` : "";

  useEffect(() => {
    if (!range) return;
    let live = true;
    void (async () => {
      setCalls(null);
      let q = createClient()
        .from("activities")
        .select("id, occurred_at, user_id, call_outcome, subject, body, contact_id, contacts(full_name, title, companies(name))")
        .eq("account_id", accountId)
        .eq("type", "call")
        .is("archived_at", null)
        .gte("occurred_at", range[0].toISOString())
        .lt("occurred_at", range[1].toISOString())
        .order("occurred_at", { ascending: false })
        .limit(LIMIT);
      if (sdr) q = q.eq("user_id", sdr);
      const { data, error: e } = await q;
      if (!live) return;
      setError(!!e);
      setCalls((data ?? []) as unknown as CallRow[]);
    })();
    return () => {
      live = false;
    };
    // range is derived from rangeKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, rangeKey, sdr]);

  useEffect(() => {
    if (!listId) return;
    let live = true;
    void (async () => {
      const ids = new Set<string>();
      for (let lo = 0; ; lo += 1000) {
        const { data } = await createClient().from("list_members").select("contact_id").eq("list_id", listId).range(lo, lo + 999);
        for (const r of data ?? []) ids.add(r.contact_id);
        if (!data || data.length < 1000) break;
      }
      if (live) setLoadedList({ listId, ids });
    })();
    return () => {
      live = false;
    };
  }, [listId]);

  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.full_name])), [people]);
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (calls ?? []).filter(
      (c) =>
        (!inList || (c.contact_id && inList.has(c.contact_id))) &&
        (!q || [c.contacts?.full_name, c.contacts?.companies?.name, c.body].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  }, [calls, inList, query]);
  const shown = outcome ? searched.filter((c) => c.call_outcome === outcome) : searched;
  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);

  const connects = shown.filter((c) => c.call_outcome && CONNECTED_OUTCOMES.includes(c.call_outcome)).length;
  const meetings = shown.filter((c) => c.call_outcome === "meeting_booked").length;
  const mix = OUTCOME_ORDER.map((o) => [o, searched.filter((c) => c.call_outcome === o).length] as const);
  const callers = new Set(shown.map((c) => c.user_id)).size;
  const filtering = !!outcome || !!listId || !!query.trim() || (canViewAny && !!sdr);

  // Export PDF (client-confirmed, 2026-11-08, approved mockup "Call Logs PDF
  // Export Mockup"): the totals for exactly these filters, counted again on
  // the server so the PDF is not held to the 2,000 calls loaded here.
  const exportHref = useMemo(() => {
    if (!range) return null;
    const last = new Date(range[1]);
    last.setDate(last.getDate() - 1);
    const p = new URLSearchParams({
      start: range[0].toISOString(),
      end: range[1].toISOString(),
      fromDay: dateKey(range[0]),
      toDay: dateKey(last),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (sdr) p.set("sdr", sdr);
    if (outcome) p.set("outcome", outcome);
    if (listId) p.set("list", listId);
    if (query.trim()) p.set("q", query.trim());
    return `/api/sdr/call-report?${p.toString()}`;
    // range is derived from rangeKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, sdr, outcome, listId, query]);
  const canExport = !!exportHref && calls !== null && !error && !(listId && !inList) && shown.length > 0;

  const reset = () => setPage(1);
  const trigger = (active: boolean) =>
    cn("h-8 w-auto min-w-[150px] text-body-sm", active ? "border-primary-700 bg-primary-50 font-semibold text-primary-900" : "bg-white");

  return (
    <section id="call-logs" className="scroll-mt-6 overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">Call Logs</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {calls === null
              ? "Loading calls…"
              : `${shown.length.toLocaleString()} ${shown.length === 1 ? "call" : "calls"} · ${connects} connects · ${callers} ${callers === 1 ? "SDR" : "SDRs"}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InfoTip
            label="About Call Logs"
            text={
              canViewAny
                ? "Every call logged on this account. Click a contact to open their full call history."
                : "Every call you've logged on this account. Click a contact to open their full call history."
            }
            className="text-white/45 hover:text-secondary-300"
          />
          {canExport ? (
            <Button asChild size="sm" variant="secondary" className="border-transparent hover:border-transparent">
              <a href={exportHref!} download>
                <Download className="mr-1.5 size-4" />
                Export PDF
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="border-transparent hover:border-transparent" disabled>
              <Download className="mr-1.5 size-4" />
              Export PDF
            </Button>
          )}
          {focusSlot}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
        <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
          <Filter className="size-4 text-secondary-700" aria-hidden="true" />
          Filter
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>When</span>
          <Select
            value={when}
            onValueChange={(v) => {
              setWhen(v as When);
              reset();
            }}
          >
            <SelectTrigger aria-label="When" className={trigger(when !== "month")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WHEN_LABEL) as When[]).map((w) => (
                <SelectItem key={w} value={w}>
                  {WHEN_LABEL[w]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {when === "custom" && (
          <>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={LABEL}>From</span>
              <Input type="date" value={from} max={to || dateKey(new Date())} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40 text-body-sm" />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={LABEL}>To</span>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 w-40 text-body-sm" />
            </label>
          </>
        )}
        {canViewAny && (
          <div className="flex min-w-0 flex-col gap-1">
            <span className={LABEL}>SDR</span>
            <Select
              value={sdr || ANY}
              onValueChange={(v) => {
                setSdr(v === ANY ? "" : v);
                reset();
              }}
            >
              <SelectTrigger aria-label="SDR" className={trigger(!!sdr)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Everyone</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Outcome</span>
          <Select
            value={outcome || ANY}
            onValueChange={(v) => {
              setOutcome(v === ANY ? "" : (v as CallOutcome));
              reset();
            }}
          >
            <SelectTrigger aria-label="Outcome" className={trigger(!!outcome)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All outcomes</SelectItem>
              {OUTCOME_ORDER.map((o) => (
                <SelectItem key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>List</span>
          <Select
            value={listId || ANY}
            onValueChange={(v) => {
              setListId(v === ANY ? "" : v);
              reset();
            }}
          >
            <SelectTrigger aria-label="List" className={cn(trigger(!!listId), "min-w-[180px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All lists</SelectItem>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Search</span>
          <span className="flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
              placeholder="Name, company or note"
              className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </span>
        </label>
        {filtering && calls && (
          <p className="flex basis-full flex-wrap items-center gap-x-2.5 text-caption text-neutral-600" aria-live="polite">
            <span>
              Showing <b className="font-semibold tabular-nums text-primary-900">{shown.length.toLocaleString()}</b> of{" "}
              <b className="font-semibold tabular-nums text-primary-900">{calls.length.toLocaleString()}</b> calls
            </span>
            <button
              type="button"
              onClick={() => {
                setOutcome("");
                setListId("");
                setQuery("");
                if (canViewAny) setSdr("");
                reset();
              }}
              className="font-semibold text-secondary-700 hover:text-secondary-800"
            >
              Clear filters
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 bg-primary-50 sm:grid-cols-4 sm:divide-x sm:divide-primary-200">
        {[
          { label: "Calls", value: shown.length.toLocaleString() },
          { label: "Connects", value: connects.toLocaleString(), tip: "Reached a person: Connected, Not interested or Meeting booked." },
          { label: "Connect rate", value: shown.length ? `${Math.round((connects / shown.length) * 100)}%` : "—", accent: true },
          { label: "Meetings booked", value: meetings.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="flex items-center gap-1 text-caption text-primary-700">
              {s.label}
              {s.tip && <InfoTip label={`About ${s.label}`} text={s.tip} />}
            </span>
            <span className={cn("text-h3 font-bold tabular-nums", s.accent ? "text-secondary-700" : "text-primary-900")}>{calls ? s.value : "—"}</span>
          </div>
        ))}
      </div>

      {searched.length > 0 && (
        <div className="border-y border-primary-200 bg-white px-5 py-3">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
            {mix
              .filter(([, n]) => n > 0)
              .map(([o, n]) => (
                <span key={o} style={{ width: `${(n / searched.length) * 100}%`, background: CALL_OUTCOME_STYLE[o].bar }} />
              ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {mix.map(([o, n]) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => {
                  setOutcome(outcome === o ? "" : o);
                  reset();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
                  outcome === o ? "border-primary-700 bg-primary-50 text-primary-900" : "border-neutral-200 bg-white text-neutral-700 hover:border-primary-300"
                )}
              >
                <span className="size-2 rounded-full" style={{ background: CALL_OUTCOME_STYLE[o].bar }} />
                {OUTCOME_LABEL[o]}
                <span className="tabular-nums text-neutral-500">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {calls === null || (listId && !inList) ? (
        <p className="px-5 py-8 text-center text-body-sm text-neutral-400">Loading calls…</p>
      ) : error ? (
        <p className="px-5 py-8 text-center text-body-sm text-error-700">Couldn&apos;t load calls. Refresh to try again.</p>
      ) : !range ? (
        <p className="px-5 py-8 text-center text-body-sm text-neutral-500">Pick a From and To date.</p>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
          {calls.length === 0 ? `No calls logged ${WHEN_LABEL[when].toLowerCase().replace("…", "")}.` : "No calls match these filters."}
        </p>
      ) : (
        <>
          {/* Below lg each call is a card. */}
          <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
            {pageRows.map((c) => (
              <article key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CallContact c={c} />
                    <p className="truncate text-caption text-neutral-500">{c.contacts?.companies?.name ?? "—"}</p>
                  </div>
                  <OutcomePill outcome={c.call_outcome} />
                </div>
                {noteOf(c) && <p className="mt-2 text-body-sm text-neutral-700">{noteOf(c)}</p>}
                <p className="mt-2 border-t border-neutral-100 pt-2 text-caption text-neutral-500">
                  {formatWhen(c.occurred_at)} · {nameOf.get(c.user_id ?? "") ?? "CRO Leader"}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[1080px]">
              <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                <span>When</span>
                <span>SDR</span>
                <span>Contact</span>
                <span>Company</span>
                <span>Outcome</span>
                <span>Note</span>
              </div>
              {pageRows.map((c) => {
                const who = nameOf.get(c.user_id ?? "") ?? "CRO Leader";
                const note = noteOf(c);
                return (
                  <div key={c.id} className={`${COLS} min-h-[52px] border-b border-neutral-100 px-5 py-2 hover:bg-neutral-50/70`}>
                    <span className="text-body-sm tabular-nums text-neutral-600">{formatWhen(c.occurred_at)}</span>
                    <span className="flex min-w-0 items-center gap-2 text-body-sm text-neutral-700">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                        {initials(who)}
                      </span>
                      <span className="truncate">{who}</span>
                    </span>
                    <span className="min-w-0">
                      <CallContact c={c} />
                      <span className="block truncate text-caption text-neutral-400">{c.contacts?.title ?? ""}</span>
                    </span>
                    <span className="truncate text-body-sm text-neutral-800" title={c.contacts?.companies?.name ?? undefined}>
                      {c.contacts?.companies?.name ?? "—"}
                    </span>
                    <span>
                      <OutcomePill outcome={c.call_outcome} />
                    </span>
                    <span className={cn("truncate text-body-sm", note ? "text-neutral-700" : "text-neutral-300")} title={note || undefined}>
                      {note || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-primary-200 bg-primary-50 px-4">
            <LocalPaginationBar
              page={page}
              pageSize={pageSize}
              totalCount={shown.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </div>
          {calls.length === LIMIT && (
            <p className="border-t border-primary-200 px-5 py-2 text-caption text-neutral-500">
              Showing the latest {LIMIT.toLocaleString()} calls. Narrow the dates to see older ones.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function CallContact({ c }: { c: CallRow }) {
  if (!c.contact_id) return <span className="text-body-sm text-neutral-400">—</span>;
  return (
    <Link
      href={`/contacts/${c.contact_id}`}
      className="block truncate text-body-sm font-semibold text-secondary-700 hover:underline"
      title={c.contacts?.full_name}
    >
      {c.contacts?.full_name ?? "Contact"}
    </Link>
  );
}

function OutcomePill({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <span className="text-body-sm text-neutral-400">Call</span>;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold", CALL_OUTCOME_STYLE[outcome].pill)}>
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}
