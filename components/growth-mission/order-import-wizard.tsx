"use client";

import { AlertTriangle, Check, ChevronDown, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ColumnCard } from "@/components/contacts/import-wizard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRIORITY_LABEL, type TaskPriority } from "@/lib/growth-mission/tasks";
import type { ImportField, ImportMapping } from "@/lib/import/fields";
import { cn } from "@/lib/utils";

interface ValidateResponse {
  headers: string[];
  mapping: ImportMapping;
  fields: ImportField[];
  totalRows: number;
  errors: { row: number; message: string }[];
  unknownOwners: { name: string; rows: number[] }[];
  overCapacity: { name: string; assigned: number; quarterly: number }[];
  duplicates: { row: number; title: string }[];
  validCount: number;
  preview: { title: string; priority: TaskPriority; owner: string | null; hours: number }[];
  rawSamples: Record<string, string>[];
}

type Step = "upload" | "map" | "validate" | "confirm";

const TEMPLATE =
  "Mission Order,Description,Priority,Owner,Status,Due,Hours\n" +
  "Write the discovery call script,Questions for the first call,Must,,Active,12/31/2026,6\n" +
  "Build the ROI calculator,,Should,GrowthMission,Active,,8.5\n";

const COLUMN_HELP: [string, string, string][] = [
  ["Mission Order", "The order's name", "Required"],
  ["Description", "What good looks like", "Blank"],
  ["Priority", "Must, Should or Could", "Must"],
  ["Owner", 'A name from the Company Profile, or "GrowthMission"', "Unassigned"],
  ["Status", "Active, In progress, On hold or Complete", "Active"],
  ["Due", "A date, e.g. 12/31/2026", "End of this quarter"],
  ["Hours", "In quarter hours, e.g. 6.25", "0"],
];

/**
 * Import Mission Orders (client-confirmed, 2026-10-20, approved mockup
 * "Import Mission Orders"). The Import Contacts wizard's four steps and
 * column cards, for one Mission Card: Upload → Map Columns → Validate →
 * Confirm. Errors block the file; warnings explain and let it through.
 */
export function OrderImportWizard({ slug, cardName }: { slug: string; cardName: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [autoMatched, setAutoMatched] = useState<Set<string>>(new Set());
  const [autoBankOpen, setAutoBankOpen] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ created: number; unassigned: number; skipped: number; skippedRows: number[] } | null>(null);

  const runValidate = async (selected: File, mapping?: ImportMapping) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", selected);
    if (mapping) formData.append("mapping", JSON.stringify(mapping));
    const res = await fetch(`/api/growth-mission/${slug}/import/validate`, { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't read that file.");
      return;
    }
    setResult(body);
    if (!mapping) {
      const matched = new Set<string>();
      for (const field of body.fields as ImportField[]) {
        const header = body.mapping[field.key];
        if (header) matched.add(header);
      }
      setAutoMatched(matched);
      setAutoBankOpen(false);
    }
    setStep(mapping ? "validate" : "map");
  };

  const handleColumnFieldChange = (header: string, fieldKey: string | null) => {
    if (!result) return;
    const next: ImportMapping = { ...result.mapping };
    for (const k of Object.keys(next)) if (next[k] === header) next[k] = null;
    if (fieldKey) next[fieldKey] = header;
    setResult({ ...result, mapping: next });
  };

  const confirm = async () => {
    if (!file || !result) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(result.mapping));
    formData.append("skip_duplicates", skipDuplicates ? "1" : "0");
    const res = await fetch(`/api/growth-mission/${slug}/import/commit`, { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(body.error ?? "Import failed.");
      if (typeof body.created === "number" && body.created > 0) router.refresh();
      return;
    }
    setStep("confirm");
    setDone(body);
    toast.success(`${body.created} mission ${body.created === 1 ? "order" : "orders"} issued.`);
    router.refresh();
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setDone(null);
    setAutoMatched(new Set());
    setSkipDuplicates(true);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mission-orders-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-baseline gap-2.5 text-body text-neutral-800">
            <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{done.created}</b>
            mission {done.created === 1 ? "order" : "orders"} issued
          </li>
          {done.unassigned > 0 && (
            <li className="flex items-baseline gap-2.5 text-body text-neutral-800">
              <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{done.unassigned}</b>
              left Unassigned
            </li>
          )}
          {done.skipped > 0 && (
            <li className="flex items-baseline gap-2.5 text-body text-neutral-800">
              <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{done.skipped}</b>
              skipped, already on this Mission Card ({done.skippedRows.length === 1 ? "row" : "rows"} {done.skippedRows.join(", ")})
            </li>
          )}
        </ul>
        <div className="flex gap-3">
          <Button onClick={() => router.push(`/growth-mission/${slug}`)}>Back to {cardName}</Button>
          <Button variant="secondary" onClick={reset}>
            Import Another File
          </Button>
        </div>
      </div>
    );
  }

  const headerToField: Record<string, string | null> = {};
  if (result) {
    for (const h of result.headers) headerToField[h] = null;
    for (const f of result.fields) {
      const h = result.mapping[f.key];
      if (h) headerToField[h] = f.key;
    }
  }
  const autoHeaders = result ? result.headers.filter((h) => autoMatched.has(h)) : [];
  const reviewHeaders = result ? result.headers.filter((h) => !autoMatched.has(h)) : [];
  const samplesFor = (h: string) => (result?.rawSamples ?? []).map((r) => r[h] ?? "");
  const warnings = result ? result.unknownOwners.length + result.overCapacity.length + result.duplicates.length : 0;
  const importCount = result ? result.validCount - (skipDuplicates ? result.duplicates.length : 0) : 0;

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
        <>
          <div className="flex max-w-md flex-col gap-3">
            <Label htmlFor="order-import-file">CSV or XLSX file</Label>
            <input
              ref={fileInputRef}
              id="order-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={loading}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                setFile(selected);
                void runValidate(selected);
              }}
              className="text-body text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-primary-700 file:px-4 file:py-2 file:text-button file:text-white hover:file:bg-primary-800"
            />
          </div>
          <div className="max-w-2xl rounded-lg border border-primary-200 bg-white p-4">
            <p className="text-body-sm font-semibold text-primary-900">What the file can include</p>
            <p className="mt-1 text-body-sm text-neutral-600">
              One row per Mission Order. Only <b>Mission Order</b> is required; every other column is optional.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-body-sm">
                <thead>
                  <tr className="text-left text-caption font-bold uppercase tracking-wide text-primary-700">
                    <th className="py-1.5 pr-4">Column</th>
                    <th className="py-1.5 pr-4">What goes in it</th>
                    <th className="py-1.5">If left empty</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-700">
                  {COLUMN_HELP.map(([col, what, empty]) => (
                    <tr key={col} className="border-t border-neutral-100">
                      <td className="py-1.5 pr-4 font-semibold text-neutral-900">{col}</td>
                      <td className="py-1.5 pr-4">{what}</td>
                      <td className={cn("py-1.5", empty === "Required" ? "text-error-700" : "text-neutral-500")}>{empty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" className="mt-3" onClick={downloadTemplate}>
              <Download className="mr-1.5 size-4" />
              Download the template
            </Button>
          </div>
        </>
      )}

      {step === "map" && result && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-secondary-50 px-5 py-3">
              <p className="flex items-center gap-2 text-body-sm text-secondary-800">
                <Check className="size-4 shrink-0" />
                {result.headers.length} column{result.headers.length === 1 ? "" : "s"} found
                {autoHeaders.length > 0 && ` — ${autoHeaders.length} auto-matched`}
                {reviewHeaders.length > 0 && `, ${reviewHeaders.length} need${reviewHeaders.length === 1 ? "s" : ""} a quick look`}.
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
                  <ChevronDown className={cn("size-4 shrink-0 text-success-700 transition-transform", autoBankOpen && "rotate-180")} />
                </button>
                {autoBankOpen && (
                  <div className="grid gap-px bg-neutral-100 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                    {autoHeaders.map((h) => (
                      <ColumnCard
                        key={h}
                        header={h}
                        index={result.headers.indexOf(h)}
                        fields={result.fields}
                        fieldKey={headerToField[h]}
                        bucket="auto"
                        samples={samplesFor(h)}
                        onChange={(v) => handleColumnFieldChange(h, v)}
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
                  {reviewHeaders.length} column{reviewHeaders.length === 1 ? "" : "s"} need{reviewHeaders.length === 1 ? "s" : ""} a quick look
                </div>
                <div className="grid gap-px bg-neutral-100 pb-px [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                  {reviewHeaders.map((h) => (
                    <ColumnCard
                      key={h}
                      header={h}
                      index={result.headers.indexOf(h)}
                      fields={result.fields}
                      fieldKey={headerToField[h]}
                      bucket="review"
                      samples={samplesFor(h)}
                      onChange={(v) => handleColumnFieldChange(h, v)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="px-5 py-4 text-body-sm text-neutral-500">Nothing else to check — every column was matched automatically.</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={reset}>
              Start Over
            </Button>
            <Button onClick={() => file && void runValidate(file, result.mapping)} disabled={loading || !result.mapping.title}>
              {loading ? "Validating…" : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {step === "validate" && result && (
        <div className="flex flex-col gap-4">
          {result.errors.length > 0 ? (
            <>
              <p className="text-body text-error-600">
                {new Set(result.errors.map((e) => e.row)).size} row{new Set(result.errors.map((e) => e.row)).size === 1 ? "" : "s"} failed
                validation — nothing has been imported. Fix the file and re-upload, or adjust the mapping.
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
                {result.validCount} mission {result.validCount === 1 ? "order" : "orders"} ready to import into {cardName}.
              </p>

              {warnings > 0 && (
                <div className="overflow-hidden rounded-xl border border-warning-300 bg-warning-50">
                  <div className="flex flex-col gap-2 px-4 py-3.5">
                    <p className="flex items-center gap-2 text-body-sm font-semibold text-warning-800">
                      <AlertTriangle className="size-4 shrink-0" />
                      {warnings} {warnings === 1 ? "thing" : "things"} to know
                    </p>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-neutral-700">
                      {result.unknownOwners.map((u) => (
                        <li key={u.name}>
                          <b>&ldquo;{u.name}&rdquo;</b> ({u.rows.length === 1 ? "row" : "rows"} {u.rows.join(", ")}) isn&apos;t on the
                          Company Profile. {u.rows.length === 1 ? "That order" : `Those ${u.rows.length} orders`} will be <b>Unassigned</b>.
                        </li>
                      ))}
                      {result.overCapacity.map((o) => (
                        <li key={o.name}>
                          <b>{o.name}</b> would have {o.assigned} hrs of open orders this quarter, {Math.round((o.assigned - o.quarterly) * 100) / 100}{" "}
                          more than {o.quarterly} hrs. You can still import.
                        </li>
                      ))}
                      {result.duplicates.map((d) => (
                        <li key={d.row}>
                          <b>&ldquo;{d.title}&rdquo;</b> (row {d.row}) is already on this Mission Card.
                        </li>
                      ))}
                    </ul>
                    {result.duplicates.length > 0 && (
                      <label className="flex items-center gap-2 text-body-sm text-neutral-800">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="size-4 accent-primary-700"
                        />
                        Skip the {result.duplicates.length} {result.duplicates.length === 1 ? "order that's" : "orders that are"} already on this
                        Mission Card
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mission Order</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Hrs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.preview.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.title}</TableCell>
                        <TableCell>{PRIORITY_LABEL[p.priority]}</TableCell>
                        <TableCell className={p.owner ? undefined : "text-neutral-400"}>{p.owner ?? "Unassigned"}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button onClick={() => void confirm()} disabled={loading || importCount <= 0}>
                  {loading ? "Importing…" : `Confirm & Import ${importCount}`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
