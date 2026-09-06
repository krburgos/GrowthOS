"use client";

import { AlertTriangle, Check, ChevronDown, Minus } from "lucide-react";
import { useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

interface ImportError {
  row: number;
  message: string;
}

interface ValidateResponse {
  headers: string[];
  mapping: ImportMapping;
  fields: ImportField[];
  totalRows: number;
  validRowCount: number;
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
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [updatedCount, setUpdatedCount] = useState<number>(0);
  const [addedToListCount, setAddedToListCount] = useState<number | null>(null);

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
    setImportedCount(null);
    await runValidate(selected);
  };

  /** A column (source header) can map to at most one GrowthOS field.
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

  const handleConfirm = async () => {
    if (!file || !result) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(result.mapping));
    if (targetListId) formData.append("list_id", targetListId);

    const res = await fetch("/api/import/commit", { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(body.error ?? "Import failed.");
      return;
    }
    setImportedCount(body.imported);
    setUpdatedCount(body.updated ?? 0);
    if (targetListId) {
      setAddedToListCount(body.addedToList);
      toast.success(`${body.addedToList} contact${body.addedToList === 1 ? "" : "s"} added to ${listName ?? "the list"}.`);
    } else {
      toast.success(
        `${body.imported} contact${body.imported === 1 ? "" : "s"} imported${
          body.updated ? `, ${body.updated} updated` : ""
        }.`
      );
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setAutoMatchedHeaders(new Set());
    setAutoBankOpen(false);
    setImportedCount(null);
    setAddedToListCount(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (importedCount !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-neutral-800">
          {targetListId
            ? `${addedToListCount} contact${addedToListCount === 1 ? "" : "s"} added to ${listName ?? "the list"}.`
            : `${importedCount} contact${importedCount === 1 ? "" : "s"} imported${
                updatedCount ? `, ${updatedCount} existing contact${updatedCount === 1 ? "" : "s"} updated` : ""
              }.`}
        </p>
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

  // Which GrowthOS field (if any) each source header currently maps
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
                {result.validRowCount} contact{result.validRowCount === 1 ? "" : "s"} ready to
                import.
              </p>
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
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? "Importing…" : `Confirm & Import ${result.validRowCount}`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
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
function ColumnCard({
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
