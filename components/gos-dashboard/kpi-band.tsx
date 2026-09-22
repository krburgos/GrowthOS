"use client";

import { ArrowRight, KanbanSquare, Plus, Radio, SlidersHorizontal, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountUp } from "@/components/ui/count-up";
import { Spinner } from "@/components/ui/spinner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  KPI_BOXES,
  activeOpportunities,
  boxAcceptsKind,
  boxTotal,
  defaultBoxFor,
  type KpiBox,
  type KpiBoxKey,
  type KpiSource,
} from "@/lib/gos-dashboard/kpi-band";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

function RecordsDialog({
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

function MappingDialog({
  accountId,
  sources,
  open,
  onOpenChange,
}: {
  accountId: string;
  sources: KpiSource[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, KpiBoxKey | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(Object.fromEntries(sources.map((s) => [s.id, s.box])));
  }, [open, sources]);

  const draftSources = sources.map((s) => ({ ...s, box: draft[s.id] ?? null }));

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const statusRows = draftSources
      .filter((s) => s.kind === "contact_status")
      .map((s) => ({ account_id: accountId, contact_status_id: s.id, box: s.box }));
    const stageRows = draftSources
      .filter((s) => s.kind === "opportunity_stage")
      .map((s) => ({ account_id: accountId, opportunity_stage_id: s.id, box: s.box }));
    const results = await Promise.all([
      statusRows.length
        ? supabase.from("gos_dashboard_kpi_mapping").upsert(statusRows, { onConflict: "account_id,contact_status_id" })
        : Promise.resolve({ error: null }),
      stageRows.length
        ? supabase.from("gos_dashboard_kpi_mapping").upsert(stageRows, { onConflict: "account_id,opportunity_stage_id" })
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const error = results.find((r) => r.error)?.error;
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("KPI mapping saved.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-32px)] max-w-[660px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KPI mapping</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            Which contact statuses and opportunity stages each box counts, for this account.
          </DialogDescription>
        </DialogHeader>

        <p className="mb-2 rounded-md bg-neutral-50 px-3 py-2 text-caption text-neutral-500">
          MQCs, MQLs and Engaged count contacts by status; the other boxes count opportunities by stage. Each status or
          stage counts toward one box at most.
        </p>

        <div className="divide-y divide-neutral-100">
          {KPI_BOXES.map((box) => {
            const inBox = draftSources.filter((s) => s.box === box.key);
            const available = draftSources.filter((s) => s.box === null && boxAcceptsKind(box.key, s.kind));
            return (
              <div key={box.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <div className="w-32 shrink-0">
                  <p className="text-body-sm font-semibold text-primary-900">{box.label}</p>
                  <p className="text-caption tabular-nums text-neutral-400">{boxTotal(draftSources, box.key).toLocaleString()} counted</p>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {inBox.map((s) => (
                    <span
                      key={s.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-caption font-medium",
                        s.kind === "contact_status"
                          ? "border-primary-100 bg-primary-50 text-primary-700"
                          : "border-secondary-100 bg-secondary-50 text-secondary-800"
                      )}
                    >
                      {s.name}
                      <span className="tabular-nums opacity-60">{s.count}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => setDraft({ ...draft, [s.id]: null })}
                        className="rounded-full p-0.5 hover:bg-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {available.length > 0 && (
                    <Select value="" onValueChange={(id) => setDraft({ ...draft, [id]: box.key })}>
                      <SelectTrigger
                        className="h-7 w-auto gap-1 rounded-full border-dashed px-2.5 text-caption font-semibold text-neutral-500"
                        aria-label={`Add to ${box.label}`}
                      >
                        <Plus className="size-3" />
                        <SelectValue placeholder="Add" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {inBox.length === 0 && available.length === 0 && (
                    <span className="text-caption text-neutral-400">Nothing left to add</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-wrap justify-between">
          <Button
            variant="ghost"
            onClick={() =>
              setDraft(Object.fromEntries(sources.map((s) => [s.id, defaultBoxFor(s.kind, s.name, s.stageGroup)])))
            }
            disabled={saving}
          >
            Reset to defaults
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save mapping"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Playbook doc's "GrowthOS KPI dashboard": Prospects + Opportunities,
 * counted live from the CRM. Client-confirmed (2026-09-22): each cell shows
 * its label and figure only - the line naming the statuses or stages behind
 * the figure repeated the label often enough to read as noise, and the same
 * detail is still one click away in the records dialog and in Edit mapping.
 * The figures count up on load, and the Opportunities header carries the
 * active total as a pill.
 *
 * Client-confirmed (2026-09-22): the figures are the point of the band, so
 * they are set at display size and given room to sit in, with the label
 * above them reduced to a quiet cap.
 *
 * Note the tone class is concatenated rather than passed through cn(): the
 * project's type scale is defined with custom names (text-display, text-h1
 * and so on), and tailwind-merge does not recognise those as font sizes, so
 * cn("text-display", "text-primary-900") silently drops the size. See the
 * comment on cn() in lib/utils.ts.
 */
const TONE_CLASS: Record<string, string> = {
  won: "text-success-700",
  lost: "text-neutral-500",
  ghosted: "text-warning-800",
  default: "text-primary-900",
};
export function KpiBand({
  accountId,
  sources,
  customized,
  canEditMapping,
}: {
  accountId: string;
  sources: KpiSource[];
  customized: boolean;
  canEditMapping: boolean;
}) {
  const [openBox, setOpenBox] = useState<KpiBox | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const renderCell = (box: KpiBox, i: number) => (
    <button
      key={box.key}
      type="button"
      onClick={() => setOpenBox(box)}
      className={cn(
        "group flex min-w-0 flex-col items-center justify-center gap-1.5 border-t border-neutral-100 px-2 pb-5 pt-4 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500",
        i > 0 && "border-l"
      )}
    >
      <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400 transition-colors group-hover:text-neutral-500">
        {box.label}
      </span>
      <CountUp
        value={boxTotal(sources, box.key)}
        className={`text-display font-bold leading-none tracking-tight tabular-nums ${TONE_CLASS[box.tone ?? "default"]}`}
      />
    </button>
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body-sm font-semibold text-neutral-600">GrowthOS KPI Dashboard</h2>
        <div className="flex items-center gap-3 text-caption text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Radio className="size-3.5" />
            Live from the CRM{customized ? "" : " · default mapping"}
          </span>
          {canEditMapping && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-secondary-700 hover:underline"
            >
              <SlidersHorizontal className="size-3.5" />
              Edit mapping
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid-cols-[3fr_5fr]">
        <div>
          <div className="flex items-center justify-center gap-1.5 bg-primary-900 px-3 py-2 text-body-sm font-semibold text-white">
            <Users className="size-3.5" />
            Prospects
          </div>
          <div className="grid grid-cols-3">{KPI_BOXES.filter((b) => b.group === "prospects").map(renderCell)}</div>
        </div>
        <div className="border-t border-neutral-200 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 bg-secondary-700 px-3 py-2 text-body-sm font-semibold text-white">
            <span className="inline-flex items-center gap-1.5">
              <KanbanSquare className="size-3.5" />
              Opportunities
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-caption font-semibold"
              title="Every stage except Won, Lost and Lost Resurrected"
            >
              Active
              <CountUp value={activeOpportunities(sources)} className="tabular-nums" />
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5">{KPI_BOXES.filter((b) => b.group === "pipeline").map(renderCell)}</div>
        </div>
      </div>

      <RecordsDialog accountId={accountId} box={openBox} sources={sources} onClose={() => setOpenBox(null)} />
      {canEditMapping && <MappingDialog accountId={accountId} sources={sources} open={mapOpen} onOpenChange={setMapOpen} />}
    </section>
  );
}
