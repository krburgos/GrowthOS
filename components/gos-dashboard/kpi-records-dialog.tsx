"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { boxTotal, type KpiBox, type KpiSource } from "@/lib/gos-dashboard/kpi-band";
import { createClient } from "@/lib/supabase/client";

/**
 * The list behind one KPI box: its 10 most recent contacts or opportunities,
 * each linking to its detail page. Lifted out of kpi-band.tsx (2026-09-22)
 * so the Homepage's hero variant of the band can open the same dialog
 * without pulling in the mapping editor, which belongs to the Command
 * Center alone.
 */
interface RecordRow {
  id: string;
  title: string;
  subtitle: string;
  source: string;
}

function unwrap<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

const RECORD_LIMIT = 10;

export function RecordsDialog({
  accountId,
  box,
  sources,
  onClose,
}: {
  accountId: string;
  box: KpiBox | null;
  sources: KpiSource[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapped = box ? sources.filter((s) => s.box === box.key) : [];
  const total = box ? boxTotal(sources, box.key) : 0;
  const isContacts = mapped.length > 0 && mapped[0].kind === "contact_status";
  const idsKey = mapped.map((s) => s.id).join(",");

  useEffect(() => {
    if (!box) return;
    setRows(null);
    setError(null);
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    const load = async () => {
      if (isContacts) {
        const { data, error: err } = await supabase
          .from("contacts")
          .select("id, full_name, title, companies(name), contact_statuses(name)")
          .eq("account_id", accountId)
          .is("archived_at", null)
          .in("status_id", ids)
          .order("updated_at", { ascending: false })
          .limit(RECORD_LIMIT);
        if (err) return setError(getFriendlyErrorMessage(err));
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            title: r.full_name,
            subtitle: [r.title, unwrap(r.companies)?.name].filter(Boolean).join(" · ") || "—",
            source: unwrap(r.contact_statuses)?.name ?? "",
          }))
        );
      } else {
        const { data, error: err } = await supabase
          .from("opportunities")
          .select("id, name, value, companies(name), opportunity_stages(name)")
          .eq("account_id", accountId)
          .in("stage_id", ids)
          .order("created_at", { ascending: false })
          .limit(RECORD_LIMIT);
        if (err) return setError(getFriendlyErrorMessage(err));
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            title: r.name,
            subtitle:
              [unwrap(r.companies)?.name, r.value != null ? `$${Number(r.value).toLocaleString()}` : null].filter(Boolean).join(" · ") ||
              "—",
            source: unwrap(r.opportunity_stages)?.name ?? "",
          }))
        );
      }
    };
    void load();
  }, [box, idsKey, isContacts, accountId]);

  if (!box) return null;
  const listHref = isContacts ? "/contacts" : "/opportunities";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {box.label} <span className="tabular-nums text-neutral-400">· {total.toLocaleString()}</span>
          </DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            {mapped.length === 0 ? "Nothing is mapped to this box yet." : `Counting ${mapped.map((s) => s.name).join(", ")}`}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-md bg-error-100 p-3 text-body-sm text-error-700">{error}</p>
        ) : rows === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md bg-neutral-50 p-4 text-body-sm text-neutral-500">No records here yet.</p>
        ) : (
          <ul className="max-h-[360px] divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`${listHref}/${r.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-neutral-800">{r.title}</p>
                    <p className="truncate text-caption text-neutral-500">{r.subtitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary-50 px-2 py-0.5 text-caption font-medium text-secondary-800">
                    {r.source}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rows && total > rows.length && (
          <p className="mt-2 text-caption text-neutral-400">
            Showing the {rows.length} most recent of {total.toLocaleString()}.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link href={listHref}>
              Open {isContacts ? "Contacts" : "Opportunities"}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
