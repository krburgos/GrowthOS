"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  TACTICAL_COLUMNS,
  TACTICAL_FIELDS,
  TACTICAL_GROUPS,
  type TacticalField,
  type TacticalGm,
  type TacticalRow,
} from "@/lib/programs/tactical";
import { monthLabel, monthsBetween } from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface TacticalClient {
  accountId: string;
  name: string;
  startMonth: string;
}

type Status = "none" | "draft" | "published";
const STATUS_LABEL: Record<Status, string> = { none: "Not started", draft: "Draft", published: "Published" };
const STATUS_CLASS: Record<Status, string> = {
  none: "bg-neutral-100 text-neutral-600",
  draft: "bg-warning-100 text-warning-800",
  published: "bg-success-100 text-success-800",
};
const HEAD = "text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary-700";

function statusOf(r: TacticalRow | undefined): Status {
  return !r ? "none" : r.published_at ? "published" : "draft";
}

function Pill({ status }: { status: Status }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-semibold", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</span>;
}

/**
 * TacticalLeads Reports on the CRO Leader Dashboard (client-confirmed
 * 2026-11-16, approved mockup "Program Reports Mockup"). CRO Admin and CRO
 * Advisor type each client's monthly numbers and publish them to the
 * client's Intel; a month is invisible to the client until published.
 * MQCs added is counted by GrowthMission (tactical_numbers()) and fixed at
 * the first publish, so a past month never shifts.
 */
export function TacticalReportsPanel({
  clients,
  reports,
  currentUserId,
  currentMonth,
  focusSlot,
}: {
  clients: TacticalClient[];
  reports: TacticalRow[];
  currentUserId: string;
  currentMonth: string;
  focusSlot?: ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(reports);
  const earliest = clients.reduce((m, c) => (c.startMonth < m ? c.startMonth : m), currentMonth);
  const months = useMemo(() => monthsBetween(earliest, currentMonth), [earliest, currentMonth]);
  const [month, setMonth] = useState(currentMonth);
  const due = clients.filter((c) => c.startMonth <= month).sort((a, b) => a.name.localeCompare(b.name));
  const [selectedId, setSelectedId] = useState<string | null>(due[0]?.accountId ?? null);
  const selected = due.find((c) => c.accountId === selectedId) ?? null;
  const rowFor = (id: string) => rows.find((r) => r.account_id === id && r.month === month);
  const publishedCount = due.filter((c) => rowFor(c.accountId)?.published_at).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 text-primary-900">TacticalLeads Reports</h2>
          <p className="text-body-sm text-neutral-500">Type each month&apos;s numbers, then publish. Clients see a month only after it&apos;s published.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger aria-label="Month" className="h-9 w-44 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {focusSlot}
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-primary-100 bg-white p-8 text-center shadow-lift">
          <p className="text-h4 text-primary-900">No TacticalLeads clients yet</p>
          <p className="text-body-sm text-neutral-500">A CRO Admin switches TacticalLeads on from a client&apos;s Programs button in Clients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="flex flex-col self-start rounded-xl border border-primary-100 bg-white shadow-lift">
            <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
              <h3 className="text-h4 text-primary-900">{monthLabel(month)}</h3>
              <span className="text-caption font-semibold tabular-nums text-neutral-500">
                {publishedCount} of {due.length} published
              </span>
            </div>
            {due.length === 0 ? (
              <p className="border-t border-neutral-100 px-5 py-4 text-body-sm text-neutral-500">No client had TacticalLeads yet in {monthLabel(month)}.</p>
            ) : (
              <ul className="flex flex-col pb-2">
                {due.map((c) => {
                  const on = c.accountId === selected?.accountId;
                  return (
                    <li key={c.accountId} className="border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.accountId)}
                        aria-current={on ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40",
                          on ? "bg-primary-50" : "hover:bg-neutral-50"
                        )}
                      >
                        <span className={cn("min-w-0 truncate text-body-sm font-semibold", on ? "text-primary-900" : "text-neutral-800")}>{c.name}</span>
                        <Pill status={statusOf(rowFor(c.accountId))} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {selected ? (
            <Editor
              key={`${selected.accountId}-${month}`}
              client={selected}
              month={month}
              report={rowFor(selected.accountId) ?? null}
              currentUserId={currentUserId}
              onSaved={(row) => {
                setRows((rs) => [...rs.filter((r) => r.id !== row.id), row]);
                router.refresh();
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-primary-200 bg-white p-10 text-center text-body-sm text-neutral-500">Choose a client.</div>
          )}
        </div>
      )}
    </section>
  );
}

function toText(v: number | string | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Whole numbers for counts; 0–100 with one decimal for percentages. */
function parse(text: string, percent?: boolean): { value: number | null; ok: boolean } {
  const t = text.replace(/[,\s%]/g, "");
  if (t === "") return { value: null, ok: true };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { value: null, ok: false };
  if (percent) return n <= 100 && /^\d+(\.\d)?$/.test(t) ? { value: n, ok: true } : { value: null, ok: false };
  return Number.isInteger(n) ? { value: n, ok: true } : { value: null, ok: false };
}

function Editor({
  client,
  month,
  report,
  currentUserId,
  onSaved,
}: {
  client: TacticalClient;
  month: string;
  report: TacticalRow | null;
  currentUserId: string;
  onSaved: (row: TacticalRow) => void;
}) {
  const [text, setText] = useState<Record<TacticalField, string>>(
    () => Object.fromEntries(TACTICAL_FIELDS.map((f) => [f.key, toText(report?.[f.key])])) as Record<TacticalField, string>
  );
  const [saved, setSaved] = useState(report);
  const [live, setLive] = useState<TacticalGm | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "unpublish">("");
  const fixed = saved?.gm_numbers ?? null;

  // MQCs added: counted live until the first publish fixes it.
  useEffect(() => {
    if (fixed) return;
    let cancelled = false;
    createClient()
      .rpc("tactical_numbers", { p_account_id: client.accountId, p_month: month })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setLiveFailed(true);
        else setLive(data as TacticalGm);
      });
    return () => {
      cancelled = true;
    };
  }, [client.accountId, month, fixed]);

  const parsed = Object.fromEntries(TACTICAL_FIELDS.map((f) => [f.key, parse(text[f.key], f.percent)])) as Record<TacticalField, { value: number | null; ok: boolean }>;
  const invalid = TACTICAL_FIELDS.filter((f) => !parsed[f.key].ok);
  const empty = TACTICAL_FIELDS.filter((f) => text[f.key].trim() === "").length;
  const status = statusOf(saved ?? undefined);
  const gm = fixed ?? live;

  async function write(kind: "save" | "publish" | "unpublish") {
    if (kind !== "unpublish" && invalid.length > 0) {
      toast.error(`Check ${invalid.map((f) => f.label).join(", ")}: counts are whole numbers, percentages 0–100 with one decimal.`);
      return;
    }
    if (kind === "publish" && !gm) {
      toast.error("MQCs added couldn't be counted. Try again in a moment.");
      return;
    }
    setBusy(kind);
    const numbers = Object.fromEntries(TACTICAL_FIELDS.map((f) => [f.key, parsed[f.key].value]));
    const payload = {
      account_id: client.accountId,
      month,
      ...(kind === "unpublish" ? {} : numbers),
      updated_by: currentUserId,
      ...(kind === "publish"
        ? { published_at: new Date().toISOString(), published_by: currentUserId, gm_numbers: fixed ?? gm }
        : kind === "unpublish"
          ? { published_at: null, published_by: null }
          : {}),
    };
    const { data, error } = await createClient()
      .from("tactical_reports")
      .upsert(payload, { onConflict: "account_id,month" })
      .select(TACTICAL_COLUMNS)
      .single();
    setBusy("");
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    const row = data as unknown as TacticalRow;
    setSaved(row);
    onSaved(row);
    toast.success(
      kind === "publish"
        ? `Published. ${client.name} can see ${monthLabel(month)} in Intel.`
        : kind === "unpublish"
          ? `Unpublished. ${client.name} no longer sees ${monthLabel(month)}.`
          : "Draft saved."
    );
  }

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-primary-100 bg-white shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-caption font-medium text-neutral-500">
            {client.name} · {monthLabel(month)}
          </p>
          <h3 className="flex flex-wrap items-center gap-2 text-h3 text-primary-900">
            TacticalLeads
            <Pill status={status} />
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {saved && (
            <Button asChild variant="secondary">
              <a href={`/api/program-reports/tactical/${saved.id}/pdf`}>
                <Download className="size-4" />
                PDF
              </a>
            </Button>
          )}
          {status === "published" ? (
            <Button variant="secondary" onClick={() => write("unpublish")} disabled={busy !== ""}>
              {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => write("save")} disabled={busy !== ""}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
          )}
          <Button onClick={() => write("publish")} disabled={busy !== ""}>
            {busy === "publish" ? "Publishing…" : status === "published" ? "Publish changes" : "Publish to client"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4">
        <h4 className={HEAD}>MQCs</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-caption font-medium text-neutral-600">
              MQCs added
              <InfoTip
                label="About MQCs added"
                text={
                  fixed
                    ? "Counted by GrowthMission and fixed when this month was first published, so it never changes."
                    : "Counted by GrowthMission: contacts added to this client's lists this month. Fixed at the first publish."
                }
              />
            </span>
            <span className="flex h-10 items-center justify-end rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body font-semibold tabular-nums text-neutral-700">
              {gm ? gm.mqcs.toLocaleString() : liveFailed ? "—" : "…"}
            </span>
          </div>
        </div>
      </div>

      {TACTICAL_GROUPS.map((g) => (
        <fieldset key={g.title} className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4">
          <legend className="sr-only">{g.title}</legend>
          <h4 className={HEAD}>{g.title}</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {g.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <Label htmlFor={`tl-${f.key}`} className="flex items-center gap-1 text-caption font-medium text-neutral-600">
                  {f.label}
                  {f.tip && <InfoTip label={`About ${f.label}`} text={f.tip} />}
                </Label>
                <div className="relative">
                  <Input
                    id={`tl-${f.key}`}
                    inputMode="decimal"
                    value={text[f.key]}
                    placeholder="—"
                    onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
                    className={cn("text-right tabular-nums", f.percent && "pr-7", !parsed[f.key].ok && "border-error-600")}
                  />
                  {f.percent && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-neutral-400">%</span>}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-caption text-neutral-500">
        <span>
          {saved?.published_at
            ? `Published ${new Date(saved.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Changes reach the client when you press Publish changes.`
            : saved
              ? `Draft saved ${new Date(saved.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. The client can't see it.`
              : "Not saved yet. The client can't see it."}
        </span>
        <span className={cn("font-medium", empty ? "text-warning-800" : "text-success-800")}>
          {empty ? `${empty} ${empty === 1 ? "number" : "numbers"} empty; they show as “—”` : "All numbers in"}
        </span>
      </div>
    </section>
  );
}
