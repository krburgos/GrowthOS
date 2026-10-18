"use client";

import { AlertTriangle, ArrowRight, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { OwnerCell, PriorityChip, StatePill, formatDue, isOverdue, orderCredits } from "@/components/growth-mission/order-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { CREDITS_PER_HOUR } from "@/lib/growth-mission/capacity";
import { SHORT_TITLE, currentQuarter, roundUpToQuarterHour } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import {
  ORDER_TYPE_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_MEANING,
  TASK_STATES,
  orderType,
  type OrderType,
  type Task,
  type TaskPriority,
  type TaskState,
} from "@/lib/growth-mission/tasks";
import { createClient } from "@/lib/supabase/client";
import { CAPACITY_CLASS, WEEKS_PER_QUARTER, capacityFor, capacityShort, formatCapacityHours } from "@/lib/team/capacity";
import type { TeamMember } from "@/lib/team/members";

const NOBODY = "__none__";

interface Draft {
  title: string;
  detail: string;
  priority: TaskPriority;
  state: TaskState;
  hours: string;
  due_date: string;
  type: OrderType;
  assignee_id: string;
}

const TYPES: { value: OrderType; hint: string }[] = [
  { value: "internal", hint: "Your in-house team" },
  { value: "outsourced", hint: "Your partners" },
  { value: "growthmission", hint: `${CREDITS_PER_HOUR} credits / hr` },
];

function draftFor(task: Task | null, priority: TaskPriority): Draft {
  if (!task) {
    return {
      title: "",
      detail: "",
      priority,
      state: "active",
      hours: "",
      // Client-confirmed (2026-10-13): a new order is due at the end of the
      // quarter unless someone picks another date.
      due_date: currentQuarter().end,
      type: "internal",
      assignee_id: NOBODY,
    };
  }
  return {
    title: task.title,
    detail: task.detail ?? "",
    priority: task.priority,
    state: task.state,
    hours: String(task.hours),
    due_date: task.due_date ?? "",
    type: orderType(task) ?? "internal",
    assignee_id: task.assignee?.id ?? NOBODY,
  };
}

/**
 * The order panel (client-confirmed, 2026-10-14, approved mockup "Mission
 * Orders Design", option D2). It opens from the right when a row on the
 * discipline page is clicked, and empty from "Issue order".
 *
 * It asks who is doing the work before anything else, because that is the
 * choice the product turns on: the MSP's own team, an outside partner, or
 * GrowthMission for credits. The person list then narrows to that type.
 *
 * A GrowthMission order spends credits when it is completed, so for anyone
 * but CRO Leader the panel locks what guard_growthmission_orders() would
 * refuse: completing it, taking it back or retiring it once CRO Leader has
 * started, and changing it at all once it is complete. The database is the
 * control; this only avoids offering a save that would fail.
 */
export function OrderPanel({
  accountId,
  slug,
  task,
  rank,
  initialPriority = "high",
  team,
  memberLoad,
  canEdit,
  isCroLeader,
  onClose,
}: {
  accountId: string;
  /** The discipline a new order is issued into. */
  slug: string;
  /** Null to issue a new order. */
  task: Task | null;
  rank?: number;
  initialPriority?: TaskPriority;
  team: TeamMember[];
  memberLoad: Record<string, number>;
  canEdit: boolean;
  isCroLeader: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFor(task, initialPriority));
  const [saving, setSaving] = useState(false);

  const isNew = task === null;
  const restricted = !isCroLeader && !!task?.delegated;
  const spent = restricted && task?.state === "complete";
  const started = restricted && !spent && task?.state !== "active";
  const lockType = !canEdit || spent || started;
  const lockArchive = spent || started;
  const lockSpent = !canEdit || spent;

  const gm = draft.type === "growthmission";
  const hours = roundUpToQuarterHour(draft.hours);
  const people = team.filter((m) => (draft.type === "outsourced" ? m.kind === "outsourced" : m.kind === "in_house"));

  // Over-capacity warns and still saves (client-confirmed, 2026-10-16).
  // memberLoad already counts this order for its current owner while it
  // is open, so take that out before adding the hours being saved.
  const owner = gm || draft.assignee_id === NOBODY ? null : people.find((m) => m.id === draft.assignee_id) ?? null;
  const ownerCap = owner
    ? capacityFor(
        owner.weekly_hours,
        (memberLoad[owner.id] ?? 0) -
          (task && task.assignee?.id === owner.id && task.state !== "complete" ? task.hours : 0) +
          (draft.state !== "complete" ? hours : 0)
      )
    : null;
  const discipline = SHORT_TITLE[task?.step_slug ?? slug] ?? PLAYBOOK_STEPS.find((s) => s.slug === slug)?.title ?? slug;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (overrides: Partial<Draft> = {}) => {
    const d = { ...draft, ...overrides };
    if (!d.title.trim()) {
      toast.error("Give the mission order a name.");
      return;
    }
    if (d.type === "growthmission" && d.state === "complete" && !isCroLeader && task?.state !== "complete") {
      toast.error("Only CRO Leader can confirm a GrowthMission order complete.");
      return;
    }
    setSaving(true);
    const delegated = d.type === "growthmission";
    const payload = {
      title: d.title.trim(),
      detail: d.detail.trim() || null,
      priority: d.priority,
      state: d.state,
      // Quarter hours (client-confirmed, 2026-10-16): a value in between rounds up.
      hours: roundUpToQuarterHour(d.hours),
      due_date: d.due_date || currentQuarter().end,
      delegated,
      assignee_id: delegated || d.assignee_id === NOBODY ? null : d.assignee_id,
    };

    const supabase = createClient();
    const { error } = task
      ? await supabase.from("growth_mission_tasks").update(payload).eq("id", task.id)
      : await supabase.from("growth_mission_tasks").insert({ ...payload, account_id: accountId, step_slug: slug });

    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(
      overrides.state === "complete" && delegated
        ? `Confirmed complete. ${payload.hours * CREDITS_PER_HOUR} credits used.`
        : isNew
          ? "Mission order issued."
          : "Mission order saved."
    );
    onClose();
    router.refresh();
  };

  const archive = async () => {
    if (!task) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("growth_mission_tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Mission order removed.");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
        <DialogHeader className="mb-0 flex flex-col gap-2 border-b border-neutral-100 px-6 pb-4 pt-5 pr-12">
          <p className="text-caption font-semibold text-secondary-700">{discipline} Mission Card › Mission Orders</p>
          <DialogTitle>{isNew ? "Issue a mission order" : task.title}</DialogTitle>
          {task ? (
            <div className="flex flex-wrap items-center gap-2">
              <PriorityChip task={task} rank={rank} />
              <StatePill state={task.state} />
            </div>
          ) : (
            <DialogDescription className="text-body-sm text-neutral-500">
              What needs doing, who is doing it, and how long it takes.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <Field label="Mission order">
            <Input value={draft.title} disabled={!canEdit} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={draft.detail}
              disabled={!canEdit}
              onChange={(e) => set({ detail: e.target.value })}
              placeholder="What good looks like, or where to start."
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-body-sm text-neutral-500">Who&apos;s doing it</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPES.map((t) => {
                const on = draft.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    disabled={lockType}
                    onClick={() =>
                      set({
                        type: t.value,
                        assignee_id: t.value === draft.type ? draft.assignee_id : NOBODY,
                        // A delegated order cannot arrive already complete.
                        state: t.value === "growthmission" && !isCroLeader && draft.state === "complete" ? "active" : draft.state,
                      })
                    }
                    className={`flex flex-col gap-0.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
                      on ? "border-secondary-500 bg-secondary-50" : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <span className="text-body-sm font-semibold text-primary-900">{ORDER_TYPE_LABEL[t.value]}</span>
                    <span className="text-caption text-neutral-500">{t.hint}</span>
                  </button>
                );
              })}
            </div>

            {gm ? (
              <div className="flex items-center justify-between rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2.5 text-body-sm text-secondary-800">
                <span className="tabular-nums">
                  {hours} hrs × {CREDITS_PER_HOUR} credits
                  {task?.state === "complete" && task.delegated ? " · used" : " · used on completion"}
                </span>
                <span className="text-h4 font-bold tabular-nums text-primary-900">{hours * CREDITS_PER_HOUR} credits</span>
              </div>
            ) : (
              <Select value={draft.assignee_id} disabled={lockType} onValueChange={(v) => set({ assignee_id: v })}>
                <SelectTrigger aria-label={`${ORDER_TYPE_LABEL[draft.type]} owner`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                  {people.map((m) => {
                    const cap = capacityFor(m.weekly_hours, memberLoad[m.id] ?? 0);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-baseline gap-2">
                          <span>{m.name}</span>
                          <span className={`text-caption ${CAPACITY_CLASS[cap.tone].text}`}>{capacityShort(cap)}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {!gm && people.length === 0 && (
              <p className="rounded-md bg-neutral-50 px-3 py-2 text-caption text-neutral-500">
                Nobody is on the Company Profile&apos;s {draft.type === "outsourced" ? "Outsourced" : "Sales & Marketing"} roster yet.
              </p>
            )}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Priority">
              <Select value={draft.priority} disabled={!canEdit} onValueChange={(v) => set({ priority: v as TaskPriority })}>
                {/* The closed field shows the tier alone; the list keeps its
                    meaning. The full "Must · Needed to hit the goal" wrapped
                    and overflowed the trigger at this width. */}
                <SelectTrigger>
                  <SelectValue>{PRIORITY_LABEL[draft.priority]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]} · {PRIORITY_MEANING[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.state} disabled={lockSpent} onValueChange={(v) => set({ state: v as TaskState })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      disabled={s.value === "complete" && gm && !isCroLeader && task?.state !== "complete"}
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input type="date" value={draft.due_date} disabled={!canEdit} onChange={(e) => set({ due_date: e.target.value })} />
            </Field>
            <Field label="Hours">
              <Input
                type="number"
                min="0"
                step="0.25"
                inputMode="decimal"
                value={draft.hours}
                disabled={lockSpent}
                onChange={(e) => set({ hours: e.target.value })}
              />
            </Field>
          </div>

          {ownerCap?.over && (
            <p className="flex items-start gap-2.5 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2.5 text-body-sm text-warning-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {`${owner!.name} would have ${formatCapacityHours(ownerCap.assigned)} hrs of open orders this quarter, ${formatCapacityHours(-ownerCap.remaining)} more than their ${formatCapacityHours(ownerCap.quarterly)} hrs (${formatCapacityHours(ownerCap.weekly)} h/wk × ${WEEKS_PER_QUARTER}). You can still save it.`}
            </p>
          )}

          {restricted && (
            <p className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-body-sm text-neutral-600">
              <Lock className="mt-0.5 size-4 shrink-0 text-neutral-500" />
              {spent
                ? `GrowthMission completed this order and ${orderCredits(task!)} credits were used. Only CRO Leader can change its status, hours or type.`
                : started
                  ? `CRO Leader has started this order, so it can no longer be taken back. GrowthMission marks it complete when the work is delivered, using ${orderCredits(task!)} credits.`
                  : `GrowthMission marks this order complete when the work is delivered, using ${orderCredits(task!)} credits. You can take it back until work starts.`}
            </p>
          )}
        </div>

        <DialogFooter className="mt-0 flex-wrap justify-between border-t border-neutral-100 px-6 py-4">
          {task && canEdit && !lockArchive ? (
            <Button variant="ghost" onClick={() => void archive()} disabled={saving} className="text-error-700">
              <Trash2 className="mr-1.5 size-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && isCroLeader && task?.delegated && task.state !== "complete" && gm && (
              <Button
                onClick={() => void save({ state: "complete" })}
                disabled={saving}
                className="bg-success-700 hover:bg-success-800"
              >
                Confirm complete · {hours * CREDITS_PER_HOUR} credits
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : isNew ? "Issue order" : "Save"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Clicking an order on Headquarters or the Command Center (client-confirmed,
 * 2026-10-14): a short prompt with the order's details and a way to its
 * Mission Card, where it is edited. Going straight there on every click
 * would make the overview tables useless for reading.
 */
export function OrderPrompt({ task, rank, onClose }: { task: Task; rank?: number; onClose: () => void }) {
  const discipline = SHORT_TITLE[task.step_slug] ?? task.step_slug;
  const credits = orderCredits(task);
  const due = formatDue(task.due_date);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader className="flex flex-col gap-2 pr-8">
          <p className="text-caption font-semibold text-secondary-700">{discipline} Mission Card</p>
          <DialogTitle>{task.title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityChip task={task} rank={rank} />
            <StatePill state={task.state} />
          </div>
          <DialogDescription className={task.detail ? "text-body-sm text-neutral-600" : "sr-only"}>
            {task.detail ?? "No description."}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3.5 text-body-sm">
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-caption text-neutral-500">Owner</dt>
            <dd>
              <OwnerCell task={task} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-neutral-500">Due</dt>
            <dd className={`tabular-nums ${isOverdue(task) ? "font-semibold text-error-700" : "text-neutral-800"}`}>
              {due ?? "No date"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-neutral-500">Hours</dt>
            <dd className="tabular-nums text-neutral-800">
              {task.hours}
              {credits !== null && <span className="text-neutral-500"> · {credits} credits</span>}
            </dd>
          </div>
        </dl>

        <DialogFooter className="flex-wrap">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link href={`/growth-mission/${task.step_slug}?order=${task.id}`}>
              Open on the {discipline} Mission Card
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body-sm text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
