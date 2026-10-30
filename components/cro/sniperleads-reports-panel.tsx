"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { FilterField, FilterTitle, filterTriggerClass } from "@/components/ui/filter-bar";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  EMPTY_OUTREACH,
  OUTREACH_TOTAL,
  defaultClosing,
  defaultIntro,
  firstName,
  monthLabel,
  monthNumber,
  monthsBetween,
  outreachFilled,
  reportHtml,
  reportStatus,
  reportText,
  type GmNumbers,
  type OutreachNumbers,
  type ReportModel,
  type ReportRow,
  type ReportStatus,
} from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface SniperLeadsClient {
  accountId: string;
  name: string;
  startMonth: string;
  ownerName: string | null;
  /** Live, from sniperleads_numbers(). */
  gm: GmNumbers;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  needs: "Needs numbers",
  ready: "Ready to export",
  exported: "Exported",
};
const STATUS_CLASS: Record<ReportStatus, string> = {
  needs: "bg-warning-100 text-warning-800",
  ready: "bg-secondary-100 text-secondary-800",
  exported: "bg-success-100 text-success-800",
};
const ANY = "__any";
const COLS = "grid grid-cols-[minmax(240px,1fr)_84px_150px_84px_110px_96px_150px_96px] items-center gap-x-3";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";

function StatusPill({ status, exportedAt }: { status: ReportStatus; exportedAt?: string | null }) {
  const label =
    status === "exported" && exportedAt
      ? `Exported ${new Date(exportedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : STATUS_LABEL[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", STATUS_CLASS[status])}>{label}</span>;
}

/**
 * CRO Leader Dashboard › SniperLeads Reports (client-confirmed, 2026-10-30,
 * approved mockup "SniperLeads Reports Mockup"). CRO Admin and CRO Advisor.
 * One row per SniperLeads client for the chosen month; Open prepares that
 * month's report and exports it. GrowthMission never sends it.
 */
export function SniperLeadsReportsPanel({
  clients,
  reports: initialReports,
  signers,
  currentUserId,
  currentMonth,
  focusSlot,
}: {
  clients: SniperLeadsClient[];
  reports: ReportRow[];
  signers: { id: string; name: string }[];
  currentUserId: string;
  currentMonth: string;
  focusSlot?: ReactNode;
}) {
  const [reports, setReports] = useState(initialReports);
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [openId, setOpenId] = useState<string | null>(null);

  const earliest = clients.reduce((min, c) => (c.startMonth < min ? c.startMonth : min), currentMonth);
  const months = monthsBetween(earliest, currentMonth);

  const byKey = useMemo(() => new Map(reports.map((r) => [`${r.account_id}|${r.month}`, r])), [reports]);
  const rows = clients
    .filter((c) => c.startMonth <= month)
    .map((c) => {
      const report = byKey.get(`${c.accountId}|${month}`) ?? null;
      return { client: c, report, status: reportStatus(report) };
    });
  const shown = rows.filter((r) => !status || r.status === status);
  const exported = rows.filter((r) => r.status === "exported").length;

  const open = rows.find((r) => r.client.accountId === openId);
  if (open) {
    return (
      <ReportEditor
        key={`${open.client.accountId}|${month}`}
        client={open.client}
        month={month}
        report={open.report}
        signers={signers}
        currentUserId={currentUserId}
        onBack={() => setOpenId(null)}
        onSaved={(row) =>
          setReports((prev) => [...prev.filter((r) => !(r.account_id === row.account_id && r.month === row.month)), row])
        }
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">SniperLeads Reports</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {rows.length === 0
              ? "No SniperLeads clients for this month."
              : `${monthLabel(month)} · ${rows.length} ${rows.length === 1 ? "client" : "clients"} · ${exported} exported · ${rows.length - exported} to finish`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InfoTip
            label="About SniperLeads Reports"
            text="A monthly report for each SniperLeads client. GrowthMission fills in its own numbers; type in the outreach numbers, then copy it into Outlook or download a PDF. Clients are switched on from the Clients list."
            className="text-white/45 hover:text-secondary-300"
          />
          {focusSlot}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
        <FilterTitle />
        <FilterField label="Month" tone="blue">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger aria-label="Month" className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(month !== currentMonth)}`}>
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
        </FilterField>
        <FilterField label="Status" tone="blue">
          <Select value={status || ANY} onValueChange={(v) => setStatus(v === ANY ? "" : (v as ReportStatus))}>
            <SelectTrigger aria-label="Status" className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(status !== "")}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
            <span>Client</span>
            <span>Month</span>
            <span>Status</span>
            <span className="text-right">Flagged</span>
            <span className="text-right">Opportunities</span>
            <span className="text-right">Meetings</span>
            <span>Outreach numbers</span>
            <span />
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
              {clients.length === 0
                ? "No client is set up for SniperLeads yet. A CRO Admin switches it on from a client's row in Clients."
                : "No reports match this filter."}
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {shown
                .sort((a, b) => a.client.name.localeCompare(b.client.name))
                .map(({ client, report, status: s }) => {
                  const filled = outreachFilled(report ?? EMPTY_OUTREACH_FOR_LIST);
                  const gm = report?.gm_numbers ?? client.gm;
                  return (
                    <div key={client.accountId} className={`${COLS} px-5 py-2.5 hover:bg-primary-50`}>
                      <span className="truncate text-body-sm font-semibold text-primary-900" title={client.name}>
                        {client.name}
                      </span>
                      <span className="text-body-sm tabular-nums text-neutral-600">Month {monthNumber(client.startMonth, month)}</span>
                      <span>
                        <StatusPill status={s} exportedAt={report?.exported_at} />
                      </span>
                      <span className="text-right text-body-sm tabular-nums text-neutral-700">{gm.flagged.toLocaleString()}</span>
                      <span className="text-right text-body-sm tabular-nums text-neutral-700">{gm.opportunities.toLocaleString()}</span>
                      <span className="text-right text-body-sm tabular-nums text-neutral-700">{gm.meetings.toLocaleString()}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                          <span
                            className={cn("block h-full", filled === OUTREACH_TOTAL ? "bg-success-700" : "bg-warning-700")}
                            style={{ width: `${(filled / OUTREACH_TOTAL) * 100}%` }}
                          />
                        </span>
                        <span className="text-caption tabular-nums text-neutral-500">
                          {filled} of {OUTREACH_TOTAL}
                        </span>
                      </span>
                      <span className="flex justify-end">
                        <Button variant="secondary" size="sm" onClick={() => setOpenId(client.accountId)}>
                          {s === "exported" ? "View" : "Open"}
                        </Button>
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-primary-200 bg-primary-100 px-5 py-2.5 text-caption tabular-nums text-primary-700">
          <span>
            <b className="font-semibold text-primary-900">{rows.reduce((n, r) => n + (r.report?.gm_numbers ?? r.client.gm).flagged, 0).toLocaleString()}</b>{" "}
            flagged in total
          </span>
          <span>
            <b className="font-semibold text-primary-900">{rows.reduce((n, r) => n + (r.report?.gm_numbers ?? r.client.gm).meetings, 0).toLocaleString()}</b>{" "}
            meetings booked
          </span>
          <span>
            <b className="font-semibold text-primary-900">
              {exported} of {rows.length}
            </b>{" "}
            exported
          </span>
        </div>
      )}
    </section>
  );
}

/** A month with no saved report has nothing filled in, LinkedIn and Website included. */
const EMPTY_OUTREACH_FOR_LIST: OutreachNumbers = { ...EMPTY_OUTREACH, linkedin_started: true, website_started: true };

type NumField = "emails_sent" | "real_replies" | "auto_replies" | "calls" | "ad_audience" | "linkedin_invites" | "linkedin_messages" | "website_visits";

const toText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
function toNum(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function ReportEditor({
  client,
  month,
  report,
  signers,
  currentUserId,
  onBack,
  onSaved,
}: {
  client: SniperLeadsClient;
  month: string;
  report: ReportRow | null;
  signers: { id: string; name: string }[];
  currentUserId: string;
  onBack: () => void;
  onSaved: (row: ReportRow) => void;
}) {
  const gm = report?.gm_numbers ?? client.gm;
  const [nums, setNums] = useState<Record<NumField, string>>({
    emails_sent: toText(report?.emails_sent),
    real_replies: toText(report?.real_replies),
    auto_replies: toText(report?.auto_replies),
    calls: toText(report?.calls),
    ad_audience: toText(report?.ad_audience),
    linkedin_invites: toText(report?.linkedin_invites),
    linkedin_messages: toText(report?.linkedin_messages),
    website_visits: toText(report?.website_visits),
  });
  const [linkedinStarted, setLinkedinStarted] = useState(report?.linkedin_started ?? false);
  const [websiteStarted, setWebsiteStarted] = useState(report?.website_started ?? false);
  const [intro, setIntro] = useState(report?.intro ?? defaultIntro(gm, month));
  const [closing, setClosing] = useState(report?.closing ?? defaultClosing());
  const defaultSigner = signers.some((s) => s.id === currentUserId) ? currentUserId : (signers[0]?.id ?? "");
  const [signerId, setSignerId] = useState(report?.signer_id ?? defaultSigner);
  const [busy, setBusy] = useState<"" | "save" | "copy" | "pdf">("");
  const [savedRow, setSavedRow] = useState(report);

  const outreach: OutreachNumbers = {
    emails_sent: toNum(nums.emails_sent),
    real_replies: toNum(nums.real_replies),
    auto_replies: toNum(nums.auto_replies),
    calls: toNum(nums.calls),
    ad_audience: toNum(nums.ad_audience),
    linkedin_started: linkedinStarted,
    linkedin_invites: toNum(nums.linkedin_invites),
    linkedin_messages: toNum(nums.linkedin_messages),
    website_started: websiteStarted,
    website_visits: toNum(nums.website_visits),
  };
  const filled = outreachFilled(outreach);
  const missing = OUTREACH_TOTAL - filled;
  const invalid = (Object.keys(nums) as NumField[]).filter((k) => nums[k].trim() !== "" && toNum(nums[k]) === null);

  const model: ReportModel = {
    clientName: client.name,
    greetingName: firstName(client.ownerName),
    monthLabel: monthLabel(month),
    monthNumber: monthNumber(client.startMonth, month),
    gm,
    outreach,
    intro: intro.trim() || defaultIntro(gm, month),
    closing: closing.trim() || defaultClosing(),
    signerName: signers.find((s) => s.id === signerId)?.name ?? "",
  };
  const html = reportHtml(model);
  const status = reportStatus({ exported_at: savedRow?.exported_at ?? null, ...outreach });

  async function save(markExported: boolean): Promise<ReportRow | null> {
    if (invalid.length > 0) {
      toast.error("Outreach numbers must be whole numbers, 0 or more.");
      return null;
    }
    const supabase = createClient();
    const payload = {
      account_id: client.accountId,
      month,
      ...outreach,
      intro: intro.trim() || null,
      closing: closing.trim() || null,
      signer_id: signerId || null,
      updated_by: currentUserId,
      ...(markExported
        ? {
            exported_at: new Date().toISOString(),
            exported_by: currentUserId,
            // The first export fixes the GM numbers; exporting again keeps them.
            gm_numbers: savedRow?.gm_numbers ?? client.gm,
          }
        : {}),
    };
    const { data, error } = await supabase
      .from("sniperleads_reports")
      .upsert(payload, { onConflict: "account_id,month" })
      .select(
        "id, account_id, month, emails_sent, real_replies, auto_replies, calls, ad_audience, linkedin_started, linkedin_invites, linkedin_messages, website_started, website_visits, intro, closing, signer_id, gm_numbers, exported_at"
      )
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return null;
    }
    const row = data as ReportRow;
    setSavedRow(row);
    onSaved(row);
    return row;
  }

  async function handleSave() {
    setBusy("save");
    const row = await save(false);
    setBusy("");
    if (row) toast.success("Draft saved.");
  }

  async function handleCopy() {
    setBusy("copy");
    const row = await save(true);
    if (row) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([reportText(model)], { type: "text/plain" }),
          }),
        ]);
        toast.success("Copied. Paste it into a new Outlook email.");
      } catch {
        toast.error("Your browser blocked copying. Use Download PDF instead.");
      }
    }
    setBusy("");
  }

  async function handlePdf() {
    setBusy("pdf");
    const row = await save(true);
    setBusy("");
    if (!row) return;
    const a = document.createElement("a");
    a.href = `/api/sniperleads/reports/${row.id}/pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const numInput = (field: NumField, label: string, className?: string) => (
    <div className={className}>
      <Label htmlFor={`sl-${field}`}>{label}</Label>
      <Input
        id={`sl-${field}`}
        inputMode="numeric"
        value={nums[field]}
        placeholder="—"
        onChange={(e) => setNums((n) => ({ ...n, [field]: e.target.value }))}
        className={cn("tabular-nums", nums[field].trim() === "" && "border-warning-700", invalid.includes(field) && "border-error-600")}
      />
    </div>
  );

  const startedSwitch = (label: string, started: boolean, set: (v: boolean) => void, onLabel: string) => (
    <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-caption" role="radiogroup" aria-label={label}>
      {[
        { v: true, text: onLabel },
        { v: false, text: "Not started" },
      ].map((o) => (
        <button
          key={o.text}
          type="button"
          role="radio"
          aria-checked={started === o.v}
          onClick={() => set(o.v)}
          className={cn(
            "rounded px-2 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
            started === o.v ? (o.v ? "bg-primary-700 text-white" : "bg-warning-100 text-warning-800") : "text-neutral-600"
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );

  const gmTile = (label: string, value: number) => (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="text-caption text-neutral-500">{label}</div>
      <b className="text-body-sm tabular-nums text-primary-900">{value.toLocaleString()}</b>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 self-start text-body-sm font-semibold text-secondary-700 hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        All SniperLeads Reports
      </button>

      <div className="overflow-hidden rounded-xl border border-primary-200 bg-white">
        <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
          <div className="min-w-0">
            <h2 className="text-h4 text-white">{client.name}</h2>
            <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
              {monthLabel(month)} · Month {model.monthNumber}
              {client.ownerName ? ` · For ${client.ownerName}` : ""}
            </p>
          </div>
          <span className="ml-auto">
            <StatusPill status={status} exportedAt={savedRow?.exported_at} />
          </span>
        </div>

        <div className="grid lg:grid-cols-[400px_1fr]">
          <form
            className="flex flex-col gap-5 border-b border-primary-200 bg-primary-50 p-5 lg:border-b-0 lg:border-r"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <h3 className={HEAD}>From GrowthMission</h3>
                <InfoTip
                  label="About these numbers"
                  text={
                    savedRow?.exported_at
                      ? "Saved when this report was first exported, so it never changes."
                      : "Counted live until you export. The first export saves them with the report, so a past month never changes."
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {gmTile("Target pool", gm.pool)}
                {gmTile("Flagged (SNIPER)", gm.flagged)}
                {gmTile("Opportunities", gm.opportunities)}
                {gmTile("Meetings booked", gm.meetings)}
                {gmTile("Proposals out", gm.proposals)}
                {gmTile("Won", gm.won)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className={HEAD}>Outreach this month</h3>
              <div className="grid grid-cols-2 gap-3">
                {numInput("emails_sent", "Emails sent")}
                {numInput("real_replies", "Real replies")}
                {numInput("auto_replies", "Auto-replies")}
                {numInput("calls", "Calls and direct emails")}
                {numInput("ad_audience", "Impression ad audience", "col-span-2")}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-neutral-800">LinkedIn</span>
                  <span className="ml-auto">{startedSwitch("LinkedIn", linkedinStarted, setLinkedinStarted, "Numbers")}</span>
                </div>
                {linkedinStarted ? (
                  <div className="grid grid-cols-2 gap-3">
                    {numInput("linkedin_invites", "Invites")}
                    {numInput("linkedin_messages", "Messages")}
                  </div>
                ) : (
                  <p className="text-caption text-neutral-500">Report shows: “Starts once access is set up.”</p>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-neutral-800">Website visits</span>
                  <span className="ml-auto">{startedSwitch("Website visits", websiteStarted, setWebsiteStarted, "Number")}</span>
                </div>
                {websiteStarted ? (
                  numInput("website_visits", "Visits")
                ) : (
                  <p className="text-caption text-neutral-500">Report shows: “Starts once the tracking pixel is installed.”</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className={HEAD}>Wording</h3>
              <div>
                <Label htmlFor="sl-intro">Opening paragraph</Label>
                <Textarea id="sl-intro" rows={4} maxLength={2000} value={intro} onChange={(e) => setIntro(e.target.value)} className="text-body-sm" />
              </div>
              <div>
                <Label htmlFor="sl-closing">Closing line</Label>
                <Textarea id="sl-closing" rows={2} maxLength={500} value={closing} onChange={(e) => setClosing(e.target.value)} className="text-body-sm" />
              </div>
              <div>
                <Label htmlFor="sl-signer">Signed by</Label>
                <Select value={signerId} onValueChange={setSignerId}>
                  <SelectTrigger id="sl-signer" className="h-9 text-body-sm">
                    <SelectValue placeholder="Choose who signs" />
                  </SelectTrigger>
                  <SelectContent>
                    {signers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>

          <div className="flex min-w-0 flex-col gap-3 bg-neutral-100 p-5">
            <div className="flex items-center gap-1.5">
              <h3 className={HEAD}>Preview</h3>
              <InfoTip label="About the preview" text="Exactly what Copy for Outlook pastes and what the PDF shows." />
            </div>
            <div className="overflow-x-auto">
              {/* Built from escaped text only (lib/sniperleads/report.ts). */}
              <div className="mx-auto w-full max-w-[640px]" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-primary-200 bg-primary-100 px-5 py-3">
          <span className={cn("text-body-sm font-medium", missing ? "text-warning-800" : "text-success-800")}>
            {missing
              ? `${missing} outreach ${missing === 1 ? "number" : "numbers"} still empty`
              : "All numbers in. Ready to export."}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleSave} disabled={busy !== ""}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="secondary" onClick={handlePdf} disabled={busy !== ""}>
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
            <Button onClick={handleCopy} disabled={busy !== ""}>
              {busy === "copy" ? "Copying…" : "Copy for Outlook"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
