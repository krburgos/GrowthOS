"use client";

import { Filter, Phone, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusPill } from "@/components/contacts/status-pill";
import { FocusButton, SectionPane } from "@/components/growth-mission/section-switcher";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { AssignListDialog } from "@/components/sdr/assign-list-dialog";
import { LogCallPanel } from "@/components/sdr/log-call-panel";
import { Button } from "@/components/ui/button";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { SdrTargetEditor } from "@/components/sdr/target-editor";
import {
  CONNECTED_OUTCOMES,
  DEFAULT_TARGET,
  dateKey,
  dueOf,
  lastTouch,
  type Assignment,
  type DailyTarget,
  type Due,
  type QueueRow,
  type RecentCall,
  type SdrPerson,
} from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Show = "today" | "new" | "tomorrow" | "all";

const QUEUE_COLS = "grid grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_150px_130px_minmax(150px,1fr)_80px_120px] items-center gap-x-4";
const BOARD_COLS = "grid grid-cols-[minmax(160px,1fr)_minmax(180px,2fr)_90px_100px_110px] items-center gap-x-4";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";
const LABEL = "text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * The SDR Outreach Mission Card's workspace (client-confirmed, 2026-10-22,
 * approved mockup "Mission Card Workspaces" v2): the Call Desk scoreboard
 * and the Call Queue, between Hours and the Arsenal.
 *
 * An SDR's queue is every contact on the lists a CRO Admin assigned them.
 * Due dates come from each contact's latest call by anyone, so a contact
 * on two SDRs' lists is never called twice in a day. "Today" is the
 * viewer's own date, which is why due-ness is worked out here rather than
 * on the server.
 */
export function CallDesk({
  accountId,
  viewerId,
  canAssign,
  canViewAny,
  canLog,
  canSetTargets,
  people,
  assignments,
  queues,
  recentCalls,
  targets,
  lists,
  meetingStageId,
  salespeople,
  scriptName,
}: {
  accountId: string;
  viewerId: string;
  canAssign: boolean;
  canViewAny: boolean;
  canLog: boolean;
  /** CRO Leader sets each SDR's daily target (client-confirmed, 2026-10-22). */
  canSetTargets: boolean;
  people: SdrPerson[];
  assignments: Assignment[];
  queues: Record<string, QueueRow[]>;
  recentCalls: RecentCall[];
  targets: Record<string, DailyTarget>;
  lists: { id: string; name: string; contacts: number }[];
  meetingStageId: string | null;
  salespeople: { id: string; full_name: string }[];
  scriptName: string | null;
}) {
  const router = useRouter();
  const holders = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.sdr_user_id))];
    const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "Unknown";
    return ids.map((id) => ({ id, full_name: name(id) })).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [assignments, people]);

  // Your own queue when you hold a list; otherwise the first SDR's, for
  // the people who may look at anyone's.
  const [sdrId, setSdrId] = useState<string | null>(() =>
    holders.some((h) => h.id === viewerId) || !canViewAny ? viewerId : holders[0]?.id ?? null
  );
  const [show, setShow] = useState<Show>("today");
  const [listFilter, setListFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [logging, setLogging] = useState<QueueRow | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Due-ness depends on the viewer's clock, so it is worked out after mount.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const isMe = sdrId === viewerId;
  const sdrName = holders.find((h) => h.id === sdrId)?.full_name ?? people.find((p) => p.id === sdrId)?.full_name ?? "";
  const myAssignments = assignments.filter((a) => a.sdr_user_id === sdrId).sort((a, b) => a.list_name.localeCompare(b.list_name));
  const queue = (sdrId && queues[sdrId]) || [];

  const withDue = useMemo(
    () => (now ? queue.map((r) => ({ row: r, due: dueOf(r, now) })) : []),
    [queue, now]
  );
  const inList = withDue.filter((r) => listFilter === "all" || r.row.lists.includes(listFilter));
  const live = inList.filter((r) => r.due !== "done");
  const count = (s: Show) => (s === "all" ? live.length : live.filter((r) => r.due === s).length);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live
      .filter((r) => show === "all" || r.due === show)
      .filter((r) => !q || r.row.full_name.toLowerCase().includes(q) || (r.row.company_name ?? "").toLowerCase().includes(q));
  }, [live, show, query]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);

  // Scoreboard: today's calls, by whoever logged them, each against that SDR's own target.
  const targetOf = (id: string | null): DailyTarget => (id && targets[id]) || DEFAULT_TARGET;
  const today = now ? dateKey(now) : null;
  const board = holders.map((h) => {
    const mine = today ? recentCalls.filter((c) => c.user_id === h.id && dateKey(new Date(c.occurred_at)) === today) : [];
    return {
      ...h,
      target: targetOf(h.id),
      calls: mine.length,
      connects: mine.filter((c) => c.call_outcome && CONNECTED_OUTCOMES.includes(c.call_outcome)).length,
      meetings: mine.filter((c) => c.call_outcome === "meeting_booked").length,
    };
  });
  const team = board.reduce((t, b) => ({ calls: t.calls + b.calls, connects: t.connects + b.connects, meetings: t.meetings + b.meetings }), {
    calls: 0,
    connects: 0,
    meetings: 0,
  });
  const selected = board.find((b) => b.id === sdrId) ?? { calls: 0, connects: 0, meetings: 0 };
  const rate = (connects: number, calls: number) => (calls > 0 ? Math.round((connects / calls) * 100) : 0);
  const whose = isMe ? "Your" : sdrName ? `${sdrName.split(" ")[0]}'s` : "";

  const unassign = async (a: Assignment) => {
    const { error } = await createClient()
      .from("sdr_list_assignments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${a.list_name} taken off ${sdrName}'s queue.`);
    router.refresh();
  };

  const afterSave = (next: boolean) => {
    const current = logging;
    setLogging(null);
    if (next && current) {
      const nextRow = rows.find((r) => r.due === "today" && r.row.contact_id !== current.contact_id);
      if (nextRow) setLogging(nextRow.row);
    }
    router.refresh();
  };

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

  const target = targetOf(sdrId);
  const stats = [
    { label: `${whose} calls today`.trim(), value: selected.calls, of: target.calls },
    { label: "Connects", value: selected.connects, suffix: ` · ${rate(selected.connects, selected.calls)}%` },
    { label: "Meetings booked", value: selected.meetings, of: target.meetings, highlight: true },
    { label: "Calls due in the queue", value: count("today") },
  ];

  return (
    <>
      {/* Call Desk: today's numbers against the daily target. */}
      <SectionPane view="desk">
      <section className="overflow-hidden rounded-lg border border-primary-200 bg-white">
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${NAVY_GRADIENT}`}>
          <h2 className="shrink-0 text-h4 text-white">
            Call Desk{" "}
            <span className="font-normal text-secondary-300">
              · {now ? now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Today"}
            </span>
          </h2>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <FocusButton view="desk" label="Call Desk" />
            {sdrId && (
              <span className="text-body-sm text-white/80">
                {isMe ? "Your daily target" : `Daily target${sdrName ? ` for ${sdrName.split(" ")[0]}` : ""}`}{" "}
                <b className="font-semibold text-white">
                  {target.calls} calls · {target.meetings} meetings
                </b>
              </span>
            )}
            {canSetTargets && sdrId && holders.some((h) => h.id === sdrId) && (
              <SdrTargetEditor
                key={sdrId}
                accountId={accountId}
                sdrId={sdrId}
                sdrName={sdrName}
                target={target}
                onSaved={() => router.refresh()}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 bg-primary-50 sm:grid-cols-4 sm:divide-x sm:divide-primary-200">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
              <span className="text-caption text-primary-700">{s.label}</span>
              <span className={cn("text-h3 font-bold tabular-nums", s.highlight ? "text-secondary-700" : "text-primary-900")}>
                {now ? s.value : "—"}
                {s.of != null && <span className="text-body-sm font-medium text-neutral-400"> / {s.of}</span>}
                {s.suffix && now && <span className="text-body-sm font-medium text-neutral-400">{s.suffix}</span>}
              </span>
            </div>
          ))}
        </div>

        {board.length > 0 && (
          <div className="overflow-x-auto border-t border-primary-200">
            <div className="min-w-[680px]">
              <div className={`${BOARD_COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                <span>Scoreboard · today</span>
                <span>Calls</span>
                <span className="text-right">Connects</span>
                <span className="text-right">Connect rate</span>
                <span className="text-right">Meetings</span>
              </div>
              {board.map((b) => {
                const pct = b.target.calls > 0 ? Math.min(100, Math.round((b.calls / b.target.calls) * 100)) : 100;
                return (
                  <div key={b.id} className={`${BOARD_COLS} border-b border-neutral-100 px-5 py-2.5`}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                        {initials(b.full_name)}
                      </span>
                      <span className="truncate text-body-sm font-semibold text-neutral-900">
                        {b.full_name}
                        {b.id === viewerId && <span className="font-normal text-neutral-400"> (you)</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
                        <span
                          className={cn("block h-full rounded-full", pct >= 100 ? "bg-success-600" : "bg-secondary-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-16 text-right text-body-sm tabular-nums text-neutral-700">
                        <b className="font-semibold text-neutral-900">{b.calls}</b>/{b.target.calls}
                      </span>
                    </span>
                    <span className="text-right text-body-sm tabular-nums text-neutral-700">{b.connects}</span>
                    <span className="text-right text-body-sm tabular-nums text-neutral-700">{rate(b.connects, b.calls)}%</span>
                    <span className="text-right text-body-sm tabular-nums">
                      <b className={cn("font-semibold", b.meetings >= b.target.meetings ? "text-success-700" : "text-primary-900")}>
                        {b.meetings}
                      </b>
                      <span className="text-neutral-400">/{b.target.meetings}</span>
                    </span>
                  </div>
                );
              })}
              {board.length > 1 && (
                <div className={`${BOARD_COLS} bg-primary-50 px-5 py-2 text-body-sm font-semibold text-primary-900`}>
                  <span>Team</span>
                  <span className="text-right tabular-nums">{team.calls} calls</span>
                  <span className="text-right tabular-nums">{team.connects}</span>
                  <span className="text-right tabular-nums">{rate(team.connects, team.calls)}%</span>
                  <span className="text-right tabular-nums">{team.meetings}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      </SectionPane>

      {/* Call Queue: the contacts on this SDR's assigned lists. */}
      <SectionPane view="queue">
      <section id="call-queue" className="scroll-mt-6 overflow-hidden rounded-xl border border-primary-200 bg-white">
        <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
          <div className="min-w-0">
            <h2 className="text-h4 text-white">Call Queue</h2>
            <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
              {sdrId && myAssignments.length > 0
                ? `${count("today")} due today · ${count("new")} never called · from ${myAssignments.length} assigned ${myAssignments.length === 1 ? "list" : "lists"}`
                : "No lists assigned yet."}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FocusButton view="queue" label="Call Queue" />
            {canViewAny && holders.length > 0 ? (
              <label className="flex items-center gap-2 text-body-sm text-white/80">
                Queue of
                <Select
                  value={sdrId ?? undefined}
                  onValueChange={(v) => {
                    setSdrId(v);
                    setListFilter("all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-48 border-white/30 bg-white text-body-sm font-semibold text-primary-900">
                    <SelectValue placeholder="Choose an SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    {holders.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : (
              !canAssign && <span className="text-body-sm text-white/80">Your queue · lists assigned by CRO Leader</span>
            )}
            {canAssign && (
              <Button size="sm" variant="secondary" className="border-transparent hover:border-transparent" onClick={() => setAssigning(true)}>
                <Plus className="mr-1.5 size-4" />
                Assign list
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-primary-200 bg-primary-50 px-5 py-2.5">
          <span className={LABEL}>Assigned lists</span>
          {myAssignments.length === 0 ? (
            <span className="text-body-sm text-neutral-500">
              {canAssign
                ? holders.length === 0
                  ? "Nobody has a list yet. Use Assign list to give an SDR contacts to call."
                  : `None. Use Assign list to give ${sdrName || "this SDR"} contacts to call.`
                : "None yet. CRO Leader assigns the lists you call."}
            </span>
          ) : (
            myAssignments.map((a) => (
              <span
                key={a.id}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border border-primary-200 bg-white pl-3 text-body-sm text-primary-900",
                  canAssign ? "pr-1" : "pr-3"
                )}
              >
                <span className="font-semibold">{a.list_name}</span>
                <span className="tabular-nums text-neutral-400">{a.contacts.toLocaleString()}</span>
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => unassign(a)}
                    title={`Take ${a.list_name} off ${sdrName}'s queue`}
                    aria-label={`Unassign ${a.list_name}`}
                    className="flex size-5 items-center justify-center rounded-full text-primary-700 hover:bg-error-100 hover:text-error-700"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {myAssignments.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
              <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
                <Filter className="size-4 text-secondary-700" aria-hidden="true" />
                Filter
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>Show</span>
                <div className="flex flex-wrap gap-1">
                  {pill("today", "Due today")}
                  {pill("new", "Never called")}
                  {pill("tomorrow", "Tomorrow")}
                  {pill("all", "All")}
                </div>
              </div>
              {myAssignments.length > 1 && (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={LABEL}>List</span>
                  <Select
                    value={listFilter}
                    onValueChange={(v) => {
                      setListFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 w-52 text-body-sm",
                        listFilter !== "all" ? "border-primary-700 bg-primary-50 font-semibold text-primary-900" : "bg-white"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All assigned lists</SelectItem>
                      {myAssignments.map((a) => (
                        <SelectItem key={a.id} value={a.list_name}>
                          {a.list_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>Search</span>
                <span className="flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
                  <Search className="size-3.5 shrink-0 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Name or company"
                    className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                  />
                </span>
              </label>
            </div>

            {!now ? (
              <p className="px-5 py-8 text-center text-body-sm text-neutral-400">Loading the queue…</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
                {live.length === 0 ? "Everyone on these lists has been reached." : "Nothing here. Every call in this view is logged."}
              </p>
            ) : (
              <>
                {/* Below lg each contact is a card. */}
                <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
                  {shown.map(({ row, due }) => (
                    <QueueCard key={row.contact_id} row={row} due={due} canLog={canLog} onLog={() => setLogging(row)} />
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <div className="min-w-[1080px]">
                    <div className={`${QUEUE_COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                      <span>Contact</span>
                      <span>Company</span>
                      <span>Phone</span>
                      <span>Status</span>
                      <span>Last touch</span>
                      <span className="text-right">Attempts</span>
                      <span className="text-right">{canLog ? "Action" : ""}</span>
                    </div>
                    {shown.map(({ row }) => {
                      const phone = row.phone ?? row.company_phone;
                      return (
                        <div key={row.contact_id} className={`${QUEUE_COLS} min-h-[58px] border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70`}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                              {initials(row.full_name)}
                            </span>
                            <span className="min-w-0">
                              <Link
                                href={`/contacts/${row.contact_id}`}
                                title={row.full_name}
                                className="block truncate text-body-sm font-semibold text-primary-900 hover:underline"
                              >
                                {row.full_name}
                              </Link>
                              <span className="block truncate text-caption text-neutral-400" title={[row.title, ...row.lists].filter(Boolean).join(" · ")}>
                                {[row.title, row.lists.join(", ")].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </span>
                          <span className="truncate text-body-sm font-medium text-neutral-800" title={row.company_name ?? undefined}>
                            {row.company_name ?? "—"}
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-body-sm tabular-nums text-neutral-700">
                            {phone ? (
                              <>
                                <Phone className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                                <span className="truncate select-all">{phone}</span>
                              </>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </span>
                          <span>{row.status_name ? <StatusPill name={row.status_name} color={row.status_color} /> : "—"}</span>
                          <span className={cn("truncate text-body-sm", row.last_call_at ? "text-neutral-600" : "text-neutral-400")}>
                            {lastTouch(row, now)}
                          </span>
                          <span className="text-right text-body-sm tabular-nums text-neutral-700">{row.attempts}</span>
                          <span className="text-right">
                            {canLog && (
                              <Button size="sm" onClick={() => setLogging(row)} className="gap-1.5">
                                <Phone className="size-3.5" />
                                Log call
                              </Button>
                            )}
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
      </SectionPane>

      {logging && (
        <LogCallPanel
          key={logging.contact_id}
          row={logging}
          accountId={accountId}
          meetingStageId={meetingStageId}
          salespeople={salespeople}
          scriptName={scriptName}
          onClose={() => setLogging(null)}
          onSaved={afterSave}
        />
      )}

      {assigning && (
        <AssignListDialog
          accountId={accountId}
          lists={lists}
          assignments={assignments}
          people={people}
          initialSdrId={sdrId}
          onClose={() => setAssigning(false)}
          onAssigned={(id) => {
            setAssigning(false);
            setSdrId(id);
            setListFilter("all");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function QueueCard({ row, due, canLog, onLog }: { row: QueueRow; due: Due; canLog: boolean; onLog: () => void }) {
  const phone = row.phone ?? row.company_phone;
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/contacts/${row.contact_id}`} className="block truncate text-body-sm font-semibold text-primary-900 hover:underline">
            {row.full_name}
          </Link>
          <p className="truncate text-caption text-neutral-500">{[row.title, row.company_name].filter(Boolean).join(" · ")}</p>
        </div>
        {row.status_name && <StatusPill name={row.status_name} color={row.status_color} className="shrink-0" />}
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="mt-2 flex min-h-[32px] items-center gap-1.5 text-body-sm tabular-nums text-secondary-700 hover:underline">
          <Phone className="size-3.5" />
          {phone}
        </a>
      )}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-100 pt-2">
        <span className="text-caption text-neutral-500">
          {due === "new" ? "Never called" : lastTouch(row)} · {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"}
        </span>
        {canLog && (
          <Button size="sm" onClick={onLog}>
            Log call
          </Button>
        )}
      </div>
    </article>
  );
}
