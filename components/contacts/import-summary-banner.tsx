"use client";

import { ChevronDown, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { readImportSummary } from "@/lib/import/summary";
import { cn } from "@/lib/utils";

/**
 * Client-confirmed (2026-11-10, approved mockup "Import Finish Mockup"):
 * a finished import lands on its list (or Contacts) with this banner. It
 * reads the summary from the address, so it survives a reload; ✕ removes
 * those keys, so it doesn't come back.
 */
export function ImportSummaryBanner({ listName, importHref }: { listName?: string; importHref: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const s = readImportSummary(new URLSearchParams(params.toString()));
  if (!s) return null;

  const dismiss = () => {
    const next = new URLSearchParams(params.toString());
    for (const key of [...next.keys()]) if (key.startsWith("imp_")) next.delete(key);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const skipped = s.noEmailCount + s.repeatCount;
  const parts: [number, string][] = [];
  if (s.addedToList !== undefined) parts.push([s.addedToList, "added to this list"]);
  parts.push([s.imported, s.addedToList !== undefined ? "new contacts" : "contacts imported"], [s.updated, "updated"]);
  if (s.unchanged) parts.push([s.unchanged, "already imported"]);
  if (skipped) parts.push([skipped, "skipped"]);

  const rowsNote = (shown: number[], count: number) =>
    `${count === 1 ? "Row" : "Rows"} ${shown.map((r) => r.toLocaleString()).join(", ")}${count > shown.length ? ` and ${(count - shown.length).toLocaleString()} more` : ""}`;

  const details: { count: number; label: string; note?: string }[] = [];
  if (s.addedToList !== undefined) details.push({ count: s.addedToList, label: `added to ${listName ?? "the list"}` });
  details.push({ count: s.imported, label: "contacts imported" }, { count: s.updated, label: "existing contacts updated" });
  if (s.unchanged) details.push({ count: s.unchanged, label: "already imported, nothing new to update" });
  if (s.kept) details.push({ count: s.kept, label: "existing contacts left unchanged" });
  if (s.restoredCompanies) {
    details.push({
      count: s.restoredCompanies,
      label: `deleted ${s.restoredCompanies === 1 ? "company" : "companies"} restored and updated from the file`,
    });
  }
  if (s.noEmailCount) {
    details.push({
      count: s.noEmailCount,
      label: `${s.noEmailCount === 1 ? "row" : "rows"} with no email skipped`,
      note: rowsNote(s.noEmailRows, s.noEmailCount),
    });
  }
  if (s.repeatCount) {
    details.push({
      count: s.repeatCount,
      label: `repeated ${s.repeatCount === 1 ? "row" : "rows"} skipped`,
      note: rowsNote(s.repeatRows, s.repeatCount),
    });
  }

  return (
    <div role="status" className="mb-5 rounded-lg border border-success-200 bg-success-50">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-success-800">
            Import finished{s.file ? `: ${s.file}` : ""}
          </p>
          <p className="mt-0.5 text-body-sm tabular-nums text-neutral-700">
            {parts.map(([count, label], i) => (
              <span key={label}>
                {i > 0 && " · "}
                <b className="font-semibold text-primary-900">{count.toLocaleString()}</b> {label}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-secondary-700 hover:underline"
          >
            {open ? "Hide details" : "Show details"}
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          </button>
          <span aria-hidden="true" className="text-neutral-300">
            ·
          </span>
          <Link href={importHref} className="text-body-sm font-semibold text-secondary-700 hover:underline">
            Import another file
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss import summary"
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-success-100"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      {open && (
        <ul className="flex flex-col gap-1.5 border-t border-success-200 py-3 pl-[52px] pr-4">
          {details.map((d) => (
            <li key={d.label} className="flex items-baseline gap-2.5 text-body text-neutral-800">
              <b className="min-w-[4ch] text-right font-bold tabular-nums text-primary-900">{d.count.toLocaleString()}</b>
              <span className="min-w-0">
                {d.label}
                {d.note && <span className="block text-body-sm text-neutral-500">{d.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
