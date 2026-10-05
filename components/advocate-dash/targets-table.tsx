"use client";

import { Check, ChevronUp, ClipboardList, MapPin, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LetterCell } from "@/components/advocate-dash/letter-cell";
import { VisitReportDialog } from "@/components/advocate-dash/visit-report-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_SECTIONS } from "@/lib/advocate-dash/report-form";
import {
  TARGET_STATUSES,
  TARGET_STATUS_CELL,
  TARGET_STATUS_LABEL,
  formatTargetDate,
  mapsUrl,
  targetSortValue,
  targetSummary,
  type AdvocateTarget,
  type TargetLetter,
  type TargetSortKey,
  type TargetStatus,
} from "@/lib/advocate-dash/targets";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { initialsOf, type TeamMember } from "@/lib/team/members";

const UNASSIGNED = "__none__";

interface Draft {
  id: string | null;
  target_name: string;
  company_name: string;
  address: string;
  advocate_member_id: string;
}

const emptyDraft = (): Draft => ({
  id: null,
  target_name: "",
  company_name: "",
  address: "",
  advocate_member_id: UNASSIGNED,
});

/**
 * The AdvocateDash drop-by list (client-confirmed, 2026-10-05).
 *
 * This is the workstream's sheet, standing where the other fifteen show
 * "What to do next". It is the same flat, sortable spreadsheet idiom — same
 * grid definition pattern, same status palette, same inline editing — so
 * the two read as one product, but its rows are targets rather than tasks
 * and its button says "Add target".
 *
 * Why not tasks with different columns: a target carries an address, an
 * advocate, a delivered letter and a seventeen-section report, and its
 * three states are Assigned / Scheduled / Completed. Nothing but the idea
 * of "a row with an owner" survives the translation.
 *
 * `canEdit` is one flag rather than the task sheet's two, because the
 * client confirmed MSP Owner/Admin and CRO Leader both edit everything
 * here. It mirrors RLS rather than standing in for it.
 */
export function TargetsTable({
  accountId,
  targets,
  team,
  canEdit,
}: {
  accountId: string;
  targets: AdvocateTarget[];
  team: TeamMember[];
  canEdit: boolean;
}) {
  const router = useRouter();
  // A local copy, so an inline change lands on click rather than after a
  // server round trip. Re-seeded from props whenever the server refreshes.
  const [rows, setRows] = useState(targets);
  useEffect(() => setRows(targets), [targets]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reportFor, setReportFor] = useState<AdvocateTarget | null>(null);
  const [sort, setSort] = useState<{ key: TargetSortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });

  const summary = targetSummary(rows);

  const patch = async (
    id: string,
    values: Record<string, unknown>,
    optimistic: Partial<AdvocateTarget>
  ) => {
    const before = rows.find((t) => t.id === id);
    if (!before) return;
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));

    const supabase = createClient();
    const { error } = await supabase.from("advocate_dash_targets").update(values).eq("id", id);
    if (error) {
      setRows((prev) => prev.map((t) => (t.id === id ? before : t)));
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  /**
   * Completing a drop-by stamps today's date if nobody set one, because the
   * Done column is the figure the service is measured on and an empty one
   * would quietly undercount it. Moving a row back off Completed leaves the
   * date alone rather than wiping it — the Done cell only renders for a
   * completed row, so there is nothing confusing on screen and nothing is
   * silently destroyed either.
   */
  const setStatus = (target: AdvocateTarget, status: TargetStatus) => {
    const completing = status === "completed" && !target.completed_on;
    const today = new Date().toISOString().slice(0, 10);
    void patch(
      target.id,
      completing ? { status, completed_on: today } : { status },
      completing ? { status, completed_on: today } : { status }
    );
  };

  const by = (a: AdvocateTarget, b: AdvocateTarget) => {
    const av = targetSortValue(a, sort.key);
    const bv = targetSortValue(b, sort.key);
    if (av === bv) return a.target_name.localeCompare(b.target_name);
    return (av < bv ? -1 : 1) * sort.dir;
  };

  const sorted = [...rows].sort(by);

  const toggleSort = (key: TargetSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const head = (key: TargetSortKey, label: string, align?: "center") => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={`flex items-center gap-1 px-2.5 py-2 text-left ${HEAD} hover:text-primary-900 ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      {label}
      <ChevronUp
        className={`size-3 transition-transform motion-reduce:transition-none ${
          sort.key === key
            ? sort.dir === 1
              ? "text-secondary-600"
              : "rotate-180 text-secondary-600"
            : "opacity-0"
        }`}
      />
    </button>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-h4 text-primary-900">Drop-by targets</h2>
          <p className="mt-0.5 text-body-sm text-neutral-500">
            {rows.length === 0
              ? "No targets yet."
              : [
                  `${summary.completed} of ${summary.targets} done`,
                  summary.scheduled > 0 ? `${summary.scheduled} scheduled` : null,
                  summary.unassigned > 0 ? `${summary.unassigned} without an advocate` : null,
                  summary.awaitingReport > 0 ? `${summary.awaitingReport} awaiting a report` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" className="ml-auto" onClick={() => setDraft(emptyDraft())}>
            <Plus className="mr-1.5 size-4" />
            Add target
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          {canEdit
            ? "Add the first business you want an Advocate to visit."
            : "No drop-by targets have been set for this account yet."}
        </p>
      ) : (
        /* Scrolls sideways rather than dropping columns: an address or an
           advocate you cannot see is how a drop-by gets missed. */
        <div className="overflow-x-auto px-5 py-5">
          <div className="min-w-[1150px] overflow-hidden rounded-md border border-neutral-200">
            <div className={`${ROW} border-b border-neutral-200 bg-neutral-50`}>
              {head("target", "Target")}
              {head("address", "Address")}
              {head("advocate", "Advocate")}
              {head("status", "Status", "center")}
              {head("done", "Done")}
              <span className={`px-2.5 py-2 ${HEAD}`}>Note</span>
              <span className={`px-2.5 py-2 ${HEAD}`}>Victory Visit Report</span>
              <span />
            </div>

            {sorted.map((target) => (
              <TargetRow
                key={target.id}
                accountId={accountId}
                target={target}
                team={team}
                canEdit={canEdit}
                patch={patch}
                setStatus={setStatus}
                onLetter={(letter) =>
                  setRows((prev) => prev.map((t) => (t.id === target.id ? { ...t, letter } : t)))
                }
                onOpenReport={() => setReportFor(target)}
                onEdit={() =>
                  setDraft({
                    id: target.id,
                    target_name: target.target_name,
                    company_name: target.company_name ?? "",
                    address: target.address ?? "",
                    advocate_member_id: target.advocate?.id ?? UNASSIGNED,
                  })
                }
              />
            ))}

            {canEdit && (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="w-full border-t border-neutral-200 bg-neutral-50 px-2.5 py-2.5 text-left text-body-sm text-neutral-400 hover:text-secondary-700"
              >
                + Target
              </button>
            )}
          </div>
        </div>
      )}

      {draft && (
        <TargetDialog
          accountId={accountId}
          draft={draft}
          setDraft={setDraft}
          team={team}
          onClose={() => setDraft(null)}
        />
      )}

      {reportFor && (
        <VisitReportDialog
          accountId={accountId}
          target={reportFor}
          canEdit={canEdit}
          onClose={() => setReportFor(null)}
        />
      )}
    </section>
  );
}

function TargetRow({
  accountId,
  target,
  team,
  canEdit,
  patch,
  setStatus,
  onLetter,
  onOpenReport,
  onEdit,
}: {
  accountId: string;
  target: AdvocateTarget;
  team: TeamMember[];
  canEdit: boolean;
  patch: (id: string, values: Record<string, unknown>, optimistic: Partial<AdvocateTarget>) => void;
  setStatus: (target: AdvocateTarget, status: TargetStatus) => void;
  onLetter: (letter: TargetLetter | null) => void;
  onOpenReport: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={`${ROW} border-t border-neutral-100 hover:bg-neutral-50/70`}>
      {/* Two lines, so this cell sets its own alignment rather than
          overriding CELL's with !important. */}
      <span className="flex min-w-0 flex-col justify-center px-2.5 py-2">
        <span className="w-full truncate text-body-sm font-medium text-neutral-900" title={target.target_name}>
          {target.target_name}
        </span>
        {target.company_name && (
          <span className="w-full truncate text-caption text-neutral-500" title={target.company_name}>
            {target.company_name}
          </span>
        )}
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        {target.address ? (
          /* Client-confirmed: the address opens Google Maps. A new tab, so
             nobody loses the sheet they were working through. */
          <a
            href={mapsUrl(target.address)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${target.address} — open in Google Maps`}
            className="inline-flex min-w-0 items-center gap-1.5 text-body-sm text-secondary-700 hover:underline"
          >
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{target.address}</span>
          </a>
        ) : (
          <span className="text-body-sm text-neutral-300">—</span>
        )}
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        {canEdit ? (
          <Select
            value={target.advocate?.id ?? UNASSIGNED}
            onValueChange={(v) =>
              patch(
                target.id,
                { advocate_member_id: v === UNASSIGNED ? null : v },
                { advocate: team.find((m) => m.id === v) ?? null }
              )
            }
          >
            <SelectTrigger
              aria-label={`Advocate for ${target.target_name}`}
              className="h-auto w-full gap-1.5 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
            >
              <Advocate advocate={target.advocate} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.kind === "outsourced" ? " (outsourced)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Advocate advocate={target.advocate} />
        )}
      </span>

      <span className="flex border-l border-neutral-100">
        <StatusCell target={target} canEdit={canEdit} onChange={(s) => setStatus(target, s)} />
      </span>

      <span className={`${CELL} border-l border-neutral-100`}>
        <DoneDateCell target={target} canEdit={canEdit} patch={patch} />
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        <LetterCell accountId={accountId} target={target} canEdit={canEdit} onUploaded={onLetter} />
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        <ReportCell target={target} canEdit={canEdit} onOpen={onOpenReport} />
      </span>

      <span className={`${CELL} justify-center border-l border-neutral-100`}>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${target.target_name}`}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

function StatusCell({
  target,
  canEdit,
  onChange,
}: {
  target: AdvocateTarget;
  canEdit: boolean;
  onChange: (status: TargetStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!canEdit) {
    return (
      <span
        className={`flex w-full items-center justify-center px-2 py-3 text-caption font-bold text-white ${TARGET_STATUS_CELL[target.status]}`}
      >
        {TARGET_STATUS_LABEL[target.status]}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Status of the drop-by for ${target.target_name}`}
        className={`flex w-full items-center justify-center px-2 py-3 text-caption font-bold text-white transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-900 motion-reduce:transition-none ${TARGET_STATUS_CELL[target.status]}`}
      >
        {TARGET_STATUS_LABEL[target.status]}
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={4} className="flex w-[150px] flex-col gap-1 p-1.5">
        {TARGET_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-current={s.value === target.status}
            onClick={() => {
              setOpen(false);
              if (s.value !== target.status) onChange(s.value);
            }}
            className={`flex items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-caption font-bold text-white hover:brightness-110 ${TARGET_STATUS_CELL[s.value]}`}
          >
            {s.label}
            {s.value === target.status && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The Done column. Only a completed drop-by has a date to show, so an
 * earlier-stage row reads as a dash rather than an empty editable cell
 * inviting somebody to date a visit that has not happened.
 */
function DoneDateCell({
  target,
  canEdit,
  patch,
}: {
  target: AdvocateTarget;
  canEdit: boolean;
  patch: (id: string, values: Record<string, unknown>, optimistic: Partial<AdvocateTarget>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(target.completed_on ?? "");

  if (target.status !== "completed") {
    return <span className="text-body-sm text-neutral-300">—</span>;
  }

  const shown = formatTargetDate(target.completed_on);

  if (!canEdit) {
    return <span className="text-body-sm tabular-nums text-neutral-600">{shown}</span>;
  }

  if (editing) {
    const commit = () => {
      setEditing(false);
      const next = value || null;
      if (next !== target.completed_on) {
        patch(target.id, { completed_on: next }, { completed_on: next });
      }
    };
    return (
      <input
        type="date"
        autoFocus
        value={value}
        aria-label={`Date the drop-by for ${target.target_name} happened`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(target.completed_on ?? "");
            setEditing(false);
          }
        }}
        className="w-[118px] rounded border border-secondary-500 px-1.5 py-0.5 text-body-sm tabular-nums text-neutral-900 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(target.completed_on ?? "");
        setEditing(true);
      }}
      aria-label={`Drop-by done ${shown} — click to change`}
      className="rounded px-1.5 py-0.5 text-body-sm tabular-nums text-neutral-600 hover:bg-neutral-100 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
    >
      {shown}
    </button>
  );
}

/**
 * The Victory Visit Report column. Three states worth distinguishing: no
 * report started, a draft part-filled, and a submitted report — because
 * "the advocate has not written it up yet" and "the advocate has signed it
 * off" are different answers to the only question an MSP Owner is asking.
 */
function ReportCell({
  target,
  canEdit,
  onOpen,
}: {
  target: AdvocateTarget;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const submitted = Boolean(target.report?.submitted_at);
  const started = Boolean(target.report);

  if (!started && !canEdit) {
    return <span className="px-1.5 text-body-sm text-neutral-300">Not filed yet</span>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-body-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 ${
        submitted
          ? "bg-success-50 text-success-800 hover:bg-success-100"
          : started
            ? "bg-warning-100 text-warning-800 hover:brightness-95"
            : "text-neutral-400 hover:text-secondary-700"
      }`}
    >
      <ClipboardList className="size-3.5 shrink-0" />
      <span className="truncate">
        {submitted
          ? "View report"
          : started
            ? `Draft · ${target.report?.sections_done ?? 0}/${REPORT_SECTIONS.length}`
            : "Fill report"}
      </span>
    </button>
  );
}

function Advocate({ advocate }: { advocate: AdvocateTarget["advocate"] }) {
  if (!advocate) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-caption text-neutral-400">
          ?
        </span>
        <span className="truncate text-body-sm text-neutral-400">Unassigned</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
          advocate.kind === "outsourced"
            ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
            : "bg-gradient-to-br from-primary-700 to-secondary-700"
        }`}
      >
        {initialsOf(advocate.name)}
      </span>
      <span className="truncate text-body-sm text-neutral-600">{advocate.name}</span>
    </span>
  );
}

/** Add or edit a target: who, where, and who is visiting them. */
function TargetDialog({
  accountId,
  draft,
  setDraft,
  team,
  onClose,
}: {
  accountId: string;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  team: TeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.target_name.trim()) {
      toast.error("A target needs a name.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const values = {
      target_name: draft.target_name.trim(),
      company_name: draft.company_name.trim() || null,
      address: draft.address.trim() || null,
      advocate_member_id: draft.advocate_member_id === UNASSIGNED ? null : draft.advocate_member_id,
    };

    const { error } = draft.id
      ? await supabase.from("advocate_dash_targets").update(values).eq("id", draft.id)
      : await supabase.from("advocate_dash_targets").insert({ ...values, account_id: accountId });

    setBusy(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(draft.id ? "Target updated." : "Target added.");
    onClose();
    router.refresh();
  };

  const archive = async () => {
    if (!draft.id) return;
    setBusy(true);
    const supabase = createClient();
    // Archived, never deleted — the repo-wide rule. The row keeps its
    // letter and its report; it simply leaves the list.
    const { error } = await supabase
      .from("advocate_dash_targets")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", draft.id);
    setBusy(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Target archived.");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit target" : "Add target"}</DialogTitle>
          <DialogDescription>
            Who the Advocate is visiting, and where. The letter and the Victory Visit Report are
            filed against this row afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="target_name" required>
              Name
            </Label>
            <Input
              id="target_name"
              value={draft.target_name}
              placeholder="Dr. Spock Plastic Surgery"
              onChange={(e) => setDraft({ ...draft, target_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company_name">Company</Label>
            <Input
              id="company_name"
              value={draft.company_name}
              placeholder="Leave empty if the name above is the business"
              onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={draft.address}
              placeholder="123 Main Street, Newton MA"
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="advocate">Advocate</Label>
            <Select
              value={draft.advocate_member_id}
              onValueChange={(v) => setDraft({ ...draft, advocate_member_id: v })}
            >
              <SelectTrigger id="advocate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.kind === "outsourced" ? " (outsourced)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {team.length === 0 && (
              <p className="mt-1 text-caption text-neutral-500">
                Add the Advocate to the Company Profile team first — they belong under Outsourced.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {draft.id ? (
            <Button variant="ghost" disabled={busy} onClick={() => void archive()}>
              Archive
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {draft.id ? "Save" : "Add target"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Eight columns, one definition — the header and the rows share it. */
const ROW =
  "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_156px_132px_112px_136px_168px_46px] items-stretch";
const CELL = "flex items-center gap-2 px-2.5 py-2";
const HEAD = "text-caption font-bold uppercase tracking-wide text-neutral-400";
