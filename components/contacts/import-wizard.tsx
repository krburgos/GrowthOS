"use client";

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
    setStep(mapping ? "validate" : "map");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setImportedCount(null);
    await runValidate(selected);
  };

  const handleMappingChange = (fieldKey: string, header: string) => {
    if (!result) return;
    setResult({ ...result, mapping: { ...result.mapping, [fieldKey]: header === "__none__" ? null : header } });
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
          <p className="text-body text-neutral-600">
            Best-guess mapping shown below — adjust anything that&apos;s wrong before continuing.
          </p>
          <div className="grid max-w-xl grid-cols-2 gap-4">
            {result.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`map-${field.key}`} required={field.required}>
                  {field.label}
                </Label>
                <Select
                  value={result.mapping[field.key] ?? "__none__"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger id={`map-${field.key}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Don&apos;t import</SelectItem>
                    {result.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
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
