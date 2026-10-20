"use client";

import { AlertTriangle, Check, ChevronDown, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportField, ImportMapping } from "@/lib/import/fields";
import type { RepeatMode, RepeatedEmail } from "@/lib/import/repeats";
import { cn } from "@/lib/utils";

/** Rows per commit request. Small enough that progress moves and no request nears a timeout. */
const BATCH_SIZE = 50;

interface Progress {
  /** Rows imported so far, out of `total` (one per email). */
  done: number;
  total: number;
  imported: number;
  updated: number;
  kept: number;
  addedToList: number;
  /** The file row index the next batch starts at. */
  nextFrom: number;
  /** Time spent importing so far, kept across a retry so the estimate stays honest. */
  elapsedMs: number;
  failed: string | null;
  finished: boolean;
}

/** "About 45 seconds left", from how fast the batches so far have gone. */
function timeLeft(p: Progress): string {
  if (p.done === 0 || p.elapsedMs === 0) return "Working out time left…";
  const seconds = ((p.elapsedMs / p.done) * (p.total - p.done)) / 1000;
  if (seconds < 10) return "A few seconds left";
  if (seconds < 60) return `About ${Math.round(seconds / 5) * 5} seconds left`;
  const minutes = Math.round(seconds / 60);
  return `About ${minutes} minute${minutes === 1 ? "" : "s"} left`;
}

/** The rows a repeat leaves out under this mode: all but the lower row to overwrite, all but the first to keep. */
function skippedRows(repeats: RepeatedEmail[], mode: RepeatMode): number[] {
  return repeats
    .filter((r) => r.rows.length > 1)
    .flatMap((r) => (mode === "overwrite" ? r.rows.slice(0, -1) : r.rows.slice(1)))
    .sort((a, b) => a - b);
}

interface ImportError {
  row: number;
  message: string;
}

interface ValidateResponse {
  headers: string[];
  mapping: ImportMapping;
  fields: ImportField[];
  totalRows: number;
  /** With no errors: how many rows are imported, one per email. */
  validRowCount: number;
  repeats: RepeatedEmail[];
  errors: ImportError[];
  preview: Record<string, string>[];
  rawSamples: Record<string, string>[];
}

type Step = "upload" | "map" | "validate" | "confirm";

/**
 * App Flow §4.4, D4 — Import Contacts. Upload → Map Columns → Validate
 * → Confirm. Any validation failure blocks the entire import (§6); the
 * user fixes the file and re-uploads, or adjusts the mapping.
 *
 * Client-confirmed list-upload mode (targetListId set): an existing
 * email is matched to that contact and added to the list rather than
 * blocking the file — see lib/import/validate.ts and the commit route.
 *
 * Client-confirmed (2026-10-18, approved mockup "Import Repeated Emails"):
 * repeated emails no longer block the file. Validate asks once whether
 * to overwrite with the file or keep the current data, and Confirm sends
 * the file in batches so it can show progress and the time left.
 */
export function ImportWizard({ targetListId, listName }: { targetListId?: string; listName?: string } = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [autoMatchedHeaders, setAutoMatchedHeaders] = useState<Set<string>>(new Set());
  const [autoBankOpen, setAutoBankOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RepeatMode>("overwrite");
  const [showRepeats, setShowRepeats] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const importing = !!progress && !progress.finished && !progress.failed;

  // Leaving mid-import would stop it after the current batch.
  useEffect(() => {
    if (!importing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [importing]);

  const runValidate = async (selectedFile: File, mapping?: ImportMapping) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    if (mapping) formData.append("mapping", JSON.stringify(mapping));
    if (targetListId) formData.append("list_id", targetListId);

    const res = await fetch("/api/import/validate", { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(body.error ?? "Couldn't read that file.");
      return;
    }
    setResult(body);
    if (!mapping) {
      // First pass only: freeze which headers the auto-guesser matched,
      // so the Map Columns screen's grouping doesn't jump around as the
      // user edits individual selections afterward.
      const matched = new Set<string>();
      for (const field of body.fields as ImportField[]) {
        const header = body.mapping[field.key];
        if (header) matched.add(header);
      }
      setAutoMatchedHeaders(matched);
      setAutoBankOpen(false);
    }
    setStep(mapping ? "validate" : "map");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setProgress(null);
    await runValidate(selected);
  };

  /** A column (source header) can map to at most one GrowthMission field.
   * Clears whichever field previously pointed at this header before
   * assigning the new one — the field the user picks may also have
   * pointed at a different header before, which a plain object-key
   * assignment already overwrites. */
  const handleColumnFieldChange = (header: string, newFieldKey: string | null) => {
    if (!result) return;
    const nextMapping: ImportMapping = { ...result.mapping };
    for (const key of Object.keys(nextMapping)) {
      if (nextMapping[key] === header) nextMapping[key] = null;
    }
    if (newFieldKey) nextMapping[newFieldKey] = header;
    setResult({ ...result, mapping: nextMapping });
  };

  const handleContinueFromMap = async () => {
    if (!file || !result) return;
    await runValidate(file, result.mapping);
  };

  /**
   * Sends the file one batch at a time. Every request re-checks the whole
   * file and decides which row wins for each email, so it only needs to
   * know where the batch starts. A failed batch stops here; Try again
   * resends it, which is safe because its saved rows match by email.
   */
  const runImport = async (start: Progress) => {
    if (!file || !result) return;
    setStep("confirm");
    let p: Progress = { ...start, failed: null };
    setProgress(p);
    const startedAt = Date.now() - p.elapsedMs;

    while (p.nextFrom < result.totalRows) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(result.mapping));
      formData.append("mode", mode);
      formData.append("from", String(p.nextFrom));
      formData.append("to", String(p.nextFrom + BATCH_SIZE));
      if (targetListId) formData.append("list_id", targetListId);

      let ok = false;
      let body: Record<string, unknown> = {};
      try {
        const res = await fetch("/api/import/commit", { method: "POST", body: formData });
        ok = res.ok;
        body = await res.json();
      } catch {
        body = { error: "The connection dropped." };
      }
      const n = (key: string) => (typeof body[key] === "number" ? (body[key] as number) : 0);

      if (!ok) {
        // Rows saved before the failure stay saved; the batch is resent whole on Try again.
        p = {
          ...p,
          imported: p.imported + n("imported"),
          updated: p.updated + n("updated"),
          kept: p.kept + n("kept"),
          elapsedMs: Date.now() - startedAt,
          failed: typeof body.error === "string" ? body.error : "Import failed.",
        };
        setProgress(p);
        return;
      }

      p = {
        ...p,
        done: p.done + n("processed"),
        imported: p.imported + n("imported"),
        updated: p.updated + n("updated"),
        kept: p.kept + n("kept"),
        addedToList: p.addedToList + n("addedToList"),
        nextFrom: n("to") > p.nextFrom ? n("to") : p.nextFrom + BATCH_SIZE,
        elapsedMs: Date.now() - startedAt,
      };
      setProgress(p);
    }

    setProgress({ ...p, done: p.total, finished: true });
    router.refresh();
    if (targetListId) {
      toast.success(`${p.addedToList} contact${p.addedToList === 1 ? "" : "s"} added to ${listName ?? "the list"}.`);
    } else {
      toast.success(
        `${p.imported} contact${p.imported === 1 ? "" : "s"} imported${p.updated ? `, ${p.updated} updated` : ""}.`
      );
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    void runImport({
      done: 0,
      total: result.validRowCount,
      imported: 0,
      updated: 0,
      kept: 0,
      addedToList: 0,
      nextFrom: 0,
      elapsedMs: 0,
      failed: null,
      finished: false,
    });
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setAutoMatchedHeaders(new Set());
    setAutoBankOpen(false);
    setProgress(null);
    setMode("overwrite");
    setShowRepeats(false);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (progress?.finished && result) {
    const skipped = skippedRows(result.repeats, mode);
    const lines: [number, string][] = targetListId
      ? [[progress.addedToList, `added to ${listName ?? "the list"}`]]
      : [];
    lines.push(
      [progress.imported, "contacts imported"],
      [progress.updated, "existing contacts updated"]
    );
    if (progress.kept > 0) lines.push([progress.kept, "existing contacts left unchanged"]);

    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          {lines.map(([count, label]) => (
            <li key={label} className="flex items-baseline gap-2.5 text-body text-neutral-800">
              <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{count}</b>
              {label}
            </li>
          ))}
          {skipped.length > 0 && (
            <li className="flex items-baseline gap-2.5 text-body text-neutral-800">
              <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{skipped.length}</b>
              <span className="min-w-0">
                repeated {skipped.length === 1 ? "row" : "rows"} skipped
                <span className="block text-body-sm text-neutral-500">
                  {skipped.length === 1 ? "Row" : "Rows"} {skipped.join(", ")}
                </span>
              </span>
            </li>
          )}
        </ul>
        <div className="flex gap-3">
          <Button onClick={() => router.push(targetListId ? `/lists/${targetListId}` : "/contacts")}>
            {targetListId ? "Back to List" : "Back to Contacts"}
          </Button>
          <Button variant="secondary" onClick={reset}>
            Import Another File
          </Button>
        </div>
      </div>
    );
  }

  // Which GrowthMission field (if any) each source header currently maps
  // to — recomputed live from `result.mapping` on every render, unlike
  // `autoMatchedHeaders` (frozen at first parse; decides section
  // placement, not current mapping state).
  const headerToField: Record<string, string | null> = {};
  if (result) {
    for (const header of result.headers) headerToField[header] = null;
    for (const field of result.fields) {
      const mappedHeader = result.mapping[field.key];
      if (mappedHeader) headerToField[mappedHeader] = field.key;
    }
  }
  const autoHeaders = result ? result.headers.filter((h) => autoMatchedHeaders.has(h)) : [];
  const reviewHeaders = result ? result.headers.filter((h) => !autoMatchedHeaders.has(h)) : [];
  const rawSamplesFor = (header: string) => (result?.rawSamples ?? []).map((row) => row[header] ?? "");

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2 text-body-sm text-neutral-500">
        {(["upload", "map", "validate", "confirm"] as Step[]).map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2", step === s && "font-medium text-primary-700")}>
            {i > 0 && <span className="text-neutral-300">→</span>}
            {s === "upload" && "Upload"}
            {s === "map" && "Map Columns"}
            {s === "validate" && "Validate"}
            {s === "confirm" && "Confirm"}
          </li>
        ))}
      </ol>

      {step === "upload" && (
        <div className="flex max-w-md flex-col gap-3">
          <Label htmlFor="import-file">CSV or XLSX file</Label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={loading}
            className="text-body text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-primary-700 file:px-4 file:py-2 file:text-button file:text-white hover:file:bg-primary-800"
          />
        </div>
      )}

      {step === "map" && result && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-secondary-50 px-5 py-3">
              <p className="flex items-center gap-2 text-body-sm text-secondary-800">
                <Check className="size-4 shrink-0" />
                {result.headers.length} column{result.headers.length === 1 ? "" : "s"} found
                {autoHeaders.length > 0 && ` — ${autoHeaders.length} auto-matched`}
                {reviewHeaders.length > 0 &&
                  `, ${reviewHeaders.length} need${reviewHeaders.length === 1 ? "s" : ""} a quick look`}
                .
              </p>
              <div className="flex gap-2">
                {result.fields
                  .filter((f) => f.required)
                  .map((f) => {
                    const ok = !!result.mapping[f.key];
                    return (
                      <span
                        key={f.key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold",
                          ok ? "bg-success-100 text-success-800" : "bg-error-100 text-error-700"
                        )}
                      >
                        {ok ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
                        {f.label}
                      </span>
                    );
                  })}
              </div>
            </div>

            {autoHeaders.length > 0 && (
              <div className="border-b border-neutral-100">
                <button
                  type="button"
                  onClick={() => setAutoBankOpen((o) => !o)}
                  aria-expanded={autoBankOpen}
                  className="flex w-full items-center justify-between gap-3 bg-success-50 px-5 py-3 text-left hover:bg-success-100/70"
                >
                  <span className="flex min-w-0 items-center gap-2 text-body-sm font-semibold text-success-800">
                    <Check className="size-4 shrink-0" />
                    {autoHeaders.length} column{autoHeaders.length === 1 ? "" : "s"} auto-matched
                    <span className="truncate font-normal text-success-700">
                      — {autoHeaders.map((h) => result.fields.find((f) => f.key === headerToField[h])?.label ?? h).join(", ")}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-success-700 transition-transform", autoBankOpen && "rotate-180")}
                  />
                </button>
                {autoBankOpen && (
                  <div className="grid gap-px bg-neutral-100 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                    {autoHeaders.map((header) => (
                      <ColumnCard
                        key={header}
                        header={header}
                        index={result.headers.indexOf(header)}
                        fields={result.fields}
                        fieldKey={headerToField[header]}
                        bucket="auto"
                        samples={rawSamplesFor(header)}
                        onChange={(v) => handleColumnFieldChange(header, v)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {reviewHeaders.length > 0 ? (
              <>
                <div className="flex items-center gap-2 px-5 pb-1 pt-4 text-body-sm font-semibold text-warning-800">
                  <AlertTriangle className="size-3.5" />
                  {reviewHeaders.length} column{reviewHeaders.length === 1 ? "" : "s"} need
                  {reviewHeaders.length === 1 ? "s" : ""} a quick look
                </div>
                <div className="grid gap-px bg-neutral-100 pb-px [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                  {reviewHeaders.map((header) => (
                    <ColumnCard
                      key={header}
                      header={header}
                      index={result.headers.indexOf(header)}
                      fields={result.fields}
                      fieldKey={headerToField[header]}
                      bucket="review"
                      samples={rawSamplesFor(header)}
                      onChange={(v) => handleColumnFieldChange(header, v)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="px-5 py-4 text-body-sm text-neutral-500">
                Nothing else to check — every column was matched automatically.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={reset}>
              Start Over
            </Button>
            <Button onClick={handleContinueFromMap} disabled={loading}>
              {loading ? "Validating…" : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && progress && (
        <div className="flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-body text-neutral-800">
              {progress.failed ? "Stopped after " : "Importing "}
              <b className="font-bold tabular-nums text-primary-900">{progress.done}</b> of{" "}
              <b className="font-bold tabular-nums text-primary-900">{progress.total}</b> contacts
            </p>
            {!progress.failed && (
              <span className="text-body-sm tabular-nums text-neutral-600">{timeLeft(progress)}</span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Import progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-2.5 overflow-hidden rounded-full bg-primary-100"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
                progress.failed ? "bg-warning-400" : "bg-primary-700"
              )}
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-3 text-body-sm tabular-nums text-neutral-600">
            <span>
              {progress.imported} imported · {progress.updated} updated
              {progress.kept > 0 && ` · ${progress.kept} left unchanged`} so far
            </span>
            <span>{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
          </div>
          {progress.failed ? (
            <>
              <p className="flex items-start gap-2 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2.5 text-body-sm text-warning-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {progress.failed} The contacts above are saved. Try again carries on from where it stopped.
                </span>
              </p>
              <div className="flex gap-3">
                <Button onClick={() => void runImport(progress)}>Try again</Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(targetListId ? `/lists/${targetListId}` : "/contacts")}
                >
                  {targetListId ? "Back to List" : "Back to Contacts"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-neutral-500">
              Keep this tab open until it finishes. You can leave the page afterwards.
            </p>
          )}
        </div>
      )}

      {step === "validate" && result && (
        <div className="flex flex-col gap-4">
          {result.errors.length > 0 ? (
            <>
              <p className="text-body text-error-600">
                {result.errors.length} row{result.errors.length === 1 ? "" : "s"} failed
                validation — nothing has been imported. Fix the file and re-upload, or adjust the
                mapping.
              </p>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep("map")}>
                  Adjust Mapping
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Upload a Different File
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-body text-neutral-800">
                {result.totalRows !== result.validRowCount && `${result.totalRows} rows in the file · `}
                {result.validRowCount} contact{result.validRowCount === 1 ? "" : "s"} will be imported or updated.
              </p>
              {result.repeats.length > 0 && (
                <RepeatsPanel
                  repeats={result.repeats}
                  mode={mode}
                  onModeChange={setMode}
                  open={showRepeats}
                  onToggle={() => setShowRepeats((o) => !o)}
                />
              )}
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ")}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.company_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button onClick={handleConfirm}>Confirm &amp; Import {result.validRowCount}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const MODE_OPTIONS: { value: RepeatMode; title: string; points: string[] }[] = [
  {
    value: "overwrite",
    title: "Overwrite with the file",
    points: [
      "Existing contacts get the file's values.",
      "If an email is in the file twice, the lower row wins.",
      "Blank cells in the file keep the contact's current value.",
    ],
  },
  {
    value: "keep",
    title: "Keep the current data",
    points: [
      "Existing contacts are left exactly as they are.",
      "If an email is in the file twice, the first row is used.",
      "The other rows are skipped and listed when the upload finishes.",
    ],
  },
];

/**
 * The repeated-emails choice on Validate (client-confirmed, 2026-10-18,
 * approved mockup "Import Repeated Emails"). Only shown when the file has
 * a repeat; Overwrite is the default because it is what imports did before.
 */
function RepeatsPanel({
  repeats,
  mode,
  onModeChange,
  open,
  onToggle,
}: {
  repeats: RepeatedEmail[];
  mode: RepeatMode;
  onModeChange: (mode: RepeatMode) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const extraRows = repeats.reduce((sum, r) => sum + r.rows.length - 1, 0);
  const existing = repeats.filter((r) => r.existing).length;
  const summary = [
    extraRows > 0 &&
      `${extraRows} ${extraRows === 1 ? "row repeats an email" : "rows repeat an email"} used on another row of this file.`,
    existing > 0 &&
      `${existing} ${existing === 1 ? "email matches a contact" : "emails match contacts"} already in this account.`,
  ]
    .filter(Boolean)
    .join(" ");

  const outcome = (r: RepeatedEmail) => {
    if (r.rows.length === 1) {
      return { used: mode === "overwrite" ? "Contact updated" : "Contact left unchanged", skipped: [] as number[] };
    }
    const usedRow = mode === "overwrite" ? r.rows[r.rows.length - 1] : r.rows[0];
    const skipped = r.rows.filter((n) => n !== usedRow);
    const used = r.existing
      ? mode === "overwrite"
        ? `Contact updated from row ${usedRow}`
        : "Contact left unchanged"
      : `Row ${usedRow} used`;
    return { used, skipped };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-warning-300 bg-warning-50">
      <div className="flex flex-col gap-1 px-4 pb-3 pt-3.5">
        <p className="flex items-center gap-2 text-body-sm font-semibold text-warning-800">
          <AlertTriangle className="size-4 shrink-0" />
          Repeated emails found
        </p>
        <p className="text-body-sm text-neutral-700">{summary}</p>
      </div>

      <div role="radiogroup" aria-label="When an email is repeated" className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
        {MODE_OPTIONS.map((o) => {
          const on = mode === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-white px-3.5 py-3",
                on ? "border-primary-500 ring-2 ring-primary-100" : "border-neutral-300 hover:border-neutral-400"
              )}
            >
              <input
                type="radio"
                name="repeat-mode"
                value={o.value}
                checked={on}
                onChange={() => onModeChange(o.value)}
                className="mt-1 size-4 shrink-0 accent-primary-700"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-body-sm font-semibold text-primary-900">
                  {o.title}
                  {o.value === "overwrite" && (
                    <span className="rounded-full bg-secondary-100 px-2 py-px text-caption font-semibold text-secondary-800">
                      Default
                    </span>
                  )}
                </span>
                <ul className="mt-1 list-disc pl-4 text-body-sm text-neutral-600">
                  {o.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-warning-300 bg-white">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-body-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          {open ? "Hide the repeated emails" : `Show every repeated email (${repeats.length})`}
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="max-h-72 overflow-auto border-t border-neutral-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>{mode === "overwrite" ? "With “Overwrite”" : "With “Keep”"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repeats.map((r) => {
                  const o = outcome(r);
                  return (
                    <TableRow key={r.email.toLowerCase()}>
                      <TableCell className="break-all">{r.email}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {r.rows.length > 1 && (
                            <span className="whitespace-nowrap rounded-full bg-warning-100 px-2 py-0.5 text-caption font-semibold text-warning-800">
                              {r.rows.length === 2 ? "Twice in file" : `${r.rows.length}× in file`}
                            </span>
                          )}
                          {r.existing && (
                            <span className="whitespace-nowrap rounded-full bg-secondary-100 px-2 py-0.5 text-caption font-semibold text-secondary-800">
                              Already a contact
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.rows.join(", ")}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-success-700">{o.used}</span>
                        {o.skipped.length > 0 && (
                          <span className="text-neutral-400">
                            {" "}
                            · {o.skipped.length === 1 ? "row" : "rows"} {o.skipped.join(", ")} skipped
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Design System §8.9-adjacent, client-confirmed Map Columns redesign
 * ("Concept A — Spreadsheet-style column cards", refined for wide
 * files with a wrap grid + collapsible auto-matched bank): one card
 * per source column, showing its raw header and real sample values
 * from the file next to the field it maps to — so mapping is a
 * recognition task against your own data, not a recall task against
 * column names you may not remember.
 */
export function ColumnCard({
  header,
  index,
  fields,
  fieldKey,
  bucket,
  samples,
  onChange,
}: {
  header: string;
  index: number;
  fields: ImportField[];
  fieldKey: string | null;
  bucket: "auto" | "review";
  samples: string[];
  onChange: (fieldKey: string | null) => void;
}) {
  const tag = !fieldKey
    ? { label: "Not mapped", cls: "bg-neutral-100 text-neutral-500", Icon: Minus }
    : bucket === "auto"
      ? { label: "Auto-matched", cls: "bg-success-100 text-success-800", Icon: Check }
      : { label: "Mapped", cls: "bg-success-100 text-success-800", Icon: Check };

  return (
    <div className="flex flex-col gap-2 bg-white p-3.5">
      <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">Column {index + 1}</span>
      <span
        className="w-fit max-w-full truncate rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-caption text-neutral-500"
        title={header}
      >
        &ldquo;{header}&rdquo;
      </span>
      <Select value={fieldKey ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Don&apos;t import</SelectItem>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold", tag.cls)}>
        <tag.Icon className="size-3" />
        {tag.label}
      </span>
      {samples.length > 0 && (
        <>
          <span className="mt-1 text-caption uppercase tracking-wide text-neutral-400">In your file</span>
          <div className="flex flex-col gap-1">
            {samples.map((v, i) => (
              <div key={i} className="truncate rounded bg-neutral-50 px-2 py-1 text-body-sm text-neutral-600">
                {v || "—"}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
