"use client";

import { Check, ChevronRight, ChevronUp, Flag, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  TASK_PRIORITY_INK,
  TASK_STATES,
  TASK_STATE_CELL,
  TASK_STATE_LABEL,
  taskSummary,
  type Task,
  type TaskPriority,
  type TaskState,
} from "@/lib/gos-dashboard/tasks";
import { currentQuarter } from "@/lib/gos-dashboard/hours";
import { createClient } from "@/lib/supabase/client";
import {
  CAPACITY_CLASS,
  capacityFor,
  capacityLabel,
  capacityShort,
  type Capacity,
} from "@/lib/team/capacity";
import { initialsOf, type TeamMember } from "@/lib/team/members";

const UNASSIGNED = "__none__";

interface Draft {
  id: string | null;
  title: string;
  detail: string;
  priority: TaskPriority;
  hours: string;
  due_date: string;
  assignee_id: string;
}

const emptyDraft = (): Draft => ({
  id: null,
  title: "",
  detail: "",
  priority: "medium",
  hours: "",
  due_date: "",
  assignee_id: UNASSIGNED,
});

type SortKey = "title" | "state" | "assignee" | "due_date" | "priority" | "hours";

/** Sort orders that are meaningful rather than alphabetical. */
const STATE_ORDER: Record<TaskState, number> = { in_progress: 0, active: 1, on_hold: 2, complete: 3 };
const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Unassigned and undated sort last whichever direction is chosen. */
function sortValue(task: Task, key: SortKey): string | number {
  switch (key) {
    case "title":
      return task.title.toLowerCase();
    case "state":
      return STATE_ORDER[task.state];
    case "assignee":
      return task.assignee?.name.toLowerCase() ?? "￿";
    case "due_date":
      return task.due_date ?? "9999-12-31";
    case "priority":
      return PRIORITY_ORDER[task.priority];
    case "hours":
      return task.hours;
  }
}

/**
 * "What to do next" — a workstream's tasks as a flat, sortable sheet
 * (client-confirmed, 2026-10-02, "C — flat and sortable").
 *
 * It replaced a board grouped by priority. Grouping answers one question
 * well and others badly: a sheet you can sort answers "everything due this
 * week", "everything on Nerm" and "the biggest jobs" with one click each,
 * which is what a spreadsheet is for. Priority stays a column, so nothing
 * is lost by no longer grouping on it.
 *
 * The detail line survives as a Notes column rather than being dropped,
 * which is the thing a wide sheet buys over a compact card row.
 *
 * Assigning is still the main verb, so state, owner, hours and the due date
 * are edited in place; the pencil opens the dialog for what the work is.
 * `canAssign` and `canDefine` are the same set of roles and mirror the
 * database rather than standing in for it — RLS decides who may write.
 */
export function TaskList({
  accountId,
  slug,
  tasks,
  team,
  memberLoad,
  canAssign,
  canDefine,
}: {
  accountId: string;
  slug: string;
  tasks: Task[];
  team: TeamMember[];
  /** Unfinished hours per member across all 14 workstreams. */
  memberLoad: Record<string, number>;
  canAssign: boolean;
  canDefine: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  // The sheet keeps its own copy of the rows so an inline change lands the
  // instant it is clicked rather than after a server round trip.
  const [rows, setRows] = useState(tasks);
  useEffect(() => setRows(tasks), [tasks]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "priority", dir: 1 });
  const [showDone, setShowDone] = useState(false);

  const summary = taskSummary(rows);

  const capacityOf = new Map<string, Capacity>(
    team.map((m) => [m.id, capacityFor(m.weekly_hours, memberLoad[m.id] ?? 0)])
  );

  const patch = async (id: string, values: Record<string, unknown>, optimistic: Partial<Task>) => {
    const before = rows.find((t) => t.id === id);
    if (!before) return;
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));

    const supabase = createClient();
    const { error } = await supabase.from("gos_dashboard_tasks").update(values).eq("id", id);
    if (error) {
      setRows((prev) => prev.map((t) => (t.id === id ? before : t)));
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  const editDraft = (task: Task): Draft => ({
    id: task.id,
    title: task.title,
    detail: task.detail ?? "",
    priority: task.priority,
    hours: String(task.hours),
    due_date: task.due_date ?? "",
    assignee_id: task.assignee?.id ?? UNASSIGNED,
  });

  const rowProps = {
    team,
    canAssign,
    canDefine,
    capacityOf,
    patch,
    onEdit: (t: Task) => setDraft(editDraft(t)),
  };

  const by = (a: Task, b: Task) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    if (av === bv) return a.title.localeCompare(b.title);
    return (av < bv ? -1 : 1) * sort.dir;
  };

  const open = rows.filter((t) => t.state !== "complete").sort(by);
  const done = rows.filter((t) => t.state === "complete").sort(by);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const head = (key: SortKey, label: string, align?: "center" | "right") => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={`flex items-center gap-1 px-2.5 py-2 text-left ${HEAD} hover:text-primary-900 ${
        align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""
      }`}
    >
      {label}
      <ChevronUp
        className={`size-3 transition-transform motion-reduce:transition-none ${
          sort.key === key ? (sort.dir === 1 ? "text-secondary-600" : "rotate-180 text-secondary-600") : "opacity-0"
        }`}
      />
    </button>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-h4 text-primary-900">What to do next</h2>
          <p className="mt-0.5 text-body-sm text-neutral-500">
            {rows.length === 0
              ? "No tasks yet."
              : `${summary.done} of ${summary.total} done · ${formatTaskHours(summary.hours)} hrs of work${
                  summary.unassigned > 0 ? ` · ${summary.unassigned} unassigned` : ""
                }`}
          </p>
        </div>
        {canDefine && (
          <Button size="sm" className="ml-auto" onClick={() => setDraft(emptyDraft())}>
            <Plus className="mr-1.5 size-4" />
            Add task
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          {canDefine
            ? "Add the first task once the report says what needs fixing."
            : "CRO Leader has not set any tasks for this workstream yet."}
        </p>
      ) : (
        <>
        {/* Below lg the sheet becomes one card per task (client-confirmed,
            2026-10-05). Nine columns at 390px is 1066px of sideways
            dragging to read one row. The card keeps the controls worth
            having on a phone — complete, state, owner — and sends the rest
            to the pencil, which opens the same dialog as the sheet. */}
        <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
          {open.map((task) => (
            <TaskCard key={task.id} task={task} {...rowProps} />
          ))}

          {done.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-left text-body-sm text-neutral-500"
              >
                <ChevronRight
                  className={`size-3.5 transition-transform motion-reduce:transition-none ${showDone ? "rotate-90" : ""}`}
                />
                <span className="font-semibold">{done.length} done</span>
              </button>
              {showDone && done.map((task) => <TaskCard key={task.id} task={task} {...rowProps} />)}
            </>
          )}
        </div>

        {/* The sheet scrolls sideways rather than dropping columns: a due
           date or an owner you cannot see is how a task gets missed. */}
        <div className="hidden overflow-x-auto px-5 py-5 lg:block">
          <div className="min-w-[1066px] overflow-hidden rounded-md border border-neutral-200">
            <div className={`${ROW} border-b border-neutral-200 bg-neutral-50`}>
              <span />
              {head("title", "Task")}
              {head("state", "Status", "center")}
              {head("assignee", "Owner")}
              {head("due_date", "Due")}
              {head("priority", "Priority")}
              {head("hours", "Est", "right")}
              <span className={`px-2.5 py-2 ${HEAD}`}>Notes</span>
              <span />
            </div>

            {open.map((task) => (
              <TaskRow key={task.id} task={task} {...rowProps} />
            ))}

            {done.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="flex w-full items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-2.5 py-2.5 text-left text-body-sm text-neutral-500 hover:text-primary-900"
                >
                  <ChevronRight
                    className={`size-3.5 transition-transform motion-reduce:transition-none ${showDone ? "rotate-90" : ""}`}
                  />
                  <span className="font-semibold">{done.length} done</span>
                </button>
                {showDone && done.map((task) => <TaskRow key={task.id} task={task} {...rowProps} />)}
              </>
            )}

            {canDefine && (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="w-full border-t border-neutral-200 bg-neutral-50 px-2.5 py-2.5 text-left text-body-sm text-neutral-400 hover:text-secondary-700"
              >
                + Task
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {draft && (
        <TaskDialog
          accountId={accountId}
          slug={slug}
          draft={draft}
          setDraft={setDraft}
          team={team}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  );
}

function StatusCell({
  task,
  canAssign,
  onChange,
}: {
  task: Task;
  canAssign: boolean;
  onChange: (state: TaskState) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!canAssign) {
    return (
      <span
        className={`flex w-full items-center justify-center px-2 py-3 text-caption font-bold text-white ${TASK_STATE_CELL[task.state]}`}
      >
        {TASK_STATE_LABEL[task.state]}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`State of ${task.title}`}
        className={`flex w-full items-center justify-center px-2 py-3 text-caption font-bold text-white transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-900 motion-reduce:transition-none ${TASK_STATE_CELL[task.state]}`}
      >
        {TASK_STATE_LABEL[task.state]}
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={4} className="flex w-[150px] flex-col gap-1 p-1.5">
        {TASK_STATES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-current={s.value === task.state}
            onClick={() => {
              setOpen(false);
              if (s.value !== task.state) onChange(s.value);
            }}
            className={`flex items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-caption font-bold text-white hover:brightness-110 ${TASK_STATE_CELL[s.value]}`}
          >
            {s.label}
            {s.value === task.state && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The hours cell (client-confirmed amendment, 2026-09-25).
 *
 * MSP Owner and Admin can now correct a task's hours, so the number is
 * editable in place rather than only through the CRO-only dialog: the
 * account running the work is usually the party that finds out an estimate
 * was wrong, and they already own the achieved-hours figure a completed
 * task feeds. A trigger enforces the same split — hours, state and
 * assignee for those roles, and nothing else.
 *
 * Editing commits on Enter or on leaving the field, and abandons on
 * Escape. It does not commit an unchanged or unparseable value, so
 * tabbing through the board writes nothing.
 */
function HoursCell({
  task,
  canEdit,
  onChange,
}: {
  task: Task;
  canEdit: boolean;
  onChange: (hours: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(task.hours));

  if (!canEdit) {
    return (
      <span className="text-body-sm font-semibold tabular-nums text-neutral-700">
        {formatTaskHours(task.hours)}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(task.hours));
      return;
    }
    if (next !== task.hours) onChange(next);
  };

  if (editing) {
    return (
      <input
        type="number"
        min="0"
        step="0.5"
        autoFocus
        value={value}
        aria-label={`Hours for ${task.title}`}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(String(task.hours));
            setEditing(false);
          }
        }}
        className="w-14 rounded border border-secondary-500 px-1.5 py-0.5 text-center text-body-sm font-semibold tabular-nums text-neutral-900 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(String(task.hours));
        setEditing(true);
      }}
      aria-label={`Hours for ${task.title} — ${formatTaskHours(task.hours)}, click to change`}
      className="rounded px-1.5 py-0.5 text-body-sm font-semibold tabular-nums text-neutral-700 hover:bg-neutral-100 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
    >
      {formatTaskHours(task.hours)}
    </button>
  );
}

/**
 * One task as a card, for widths below `lg`.
 *
 * Complete, state and owner stay editable in place — they are what gets
 * changed while away from a desk, and completing is the row's most
 * consequential control because it moves hours into the quarter's achieved
 * figure. Due date, estimate and notes are read-only here and edit through
 * the pencil, so a card never becomes a four-input form.
 */
function TaskCard({ task, team, canAssign, canDefine, capacityOf, patch, onEdit }: RowProps & { task: Task }) {
  const done = task.state === "complete";

  return (
    <article className={`rounded-xl border bg-white p-3.5 ${done ? "border-neutral-200" : "border-neutral-200"}`}>
      <div className="flex items-start gap-3">
        {canAssign ? (
          <button
            type="button"
            onClick={() =>
              void patch(task.id, { state: done ? "active" : "complete" }, { state: done ? "active" : "complete" })
            }
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
              done ? "border-success-600 bg-success-600 text-white" : "border-neutral-300"
            }`}
          >
            {done && <Check className="size-3.5" strokeWidth={3} />}
          </button>
        ) : (
          <span
            className={`mt-0.5 block size-6 shrink-0 rounded border-[1.5px] ${
              done ? "border-success-600 bg-success-600" : "border-neutral-300"
            }`}
          />
        )}

        <div className="min-w-0 flex-1">
          <h3
            className={`text-body font-medium leading-snug ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
          >
            {task.title}
          </h3>
          {task.detail && <p className="mt-0.5 text-caption text-neutral-500">{task.detail}</p>}
        </div>

        {canDefine && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-secondary-700"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500">
        <span className={`inline-flex items-center gap-1 font-semibold ${TASK_PRIORITY_INK[task.priority]}`}>
          <Flag className="size-3" />
          <span className="capitalize">{task.priority}</span>
        </span>
        <span className="tabular-nums">{formatTaskHours(task.hours)} hrs</span>
        {task.due_date && (
          <span className="tabular-nums">
            Due {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {/* Two rows, not one (client-confirmed fix, 2026-10-05). Side by side,
          the status pill and the owner collided — the owner's avatar sat
          hard against the pill's rounded edge and read as overlapping it.
          The status keeps its own line at its natural width; the owner gets
          the next one as a full-width control.

          The owner also drops the table cell's borderless trigger here. That
          override exists so a Select can sit inside a 136px column without
          looking like a form field; in a card it just read as floating text
          with a stray chevron, and it was below a comfortable tap size. */}
      <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        <div className="flex w-[132px] overflow-hidden rounded-lg">
          <StatusCell task={task} canAssign={canAssign} onChange={(state) => void patch(task.id, { state }, { state })} />
        </div>
        {canAssign ? (
          <Select
            value={task.assignee?.id ?? UNASSIGNED}
            onValueChange={(v) =>
              void patch(
                task.id,
                { assignee_id: v === UNASSIGNED ? null : v },
                { assignee: team.find((m) => m.id === v) ?? null }
              )
            }
          >
            <SelectTrigger aria-label={`Who is doing ${task.title}`} className="h-auto min-h-[44px]">
              <Owner assignee={task.assignee} capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
              {team.map((m) => {
                const cap = capacityOf.get(m.id);
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-baseline gap-2">
                      <span>
                        {m.name}
                        {m.kind === "outsourced" ? " (outsourced)" : ""}
                      </span>
                      {cap && <span className={`text-caption ${CAPACITY_CLASS[cap.tone].text}`}>{capacityShort(cap)}</span>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex min-h-[44px] items-center rounded-md border border-neutral-200 px-3">
            <Owner assignee={task.assignee} capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined} />
          </div>
        )}
      </div>
    </article>
  );
}

/** One row of the sheet. */
function TaskRow({
  task,
  team,
  canAssign,
  canDefine,
  capacityOf,
  patch,
  onEdit,
}: RowProps & { task: Task }) {
  const done = task.state === "complete";

  return (
    <div className={`${ROW} border-t border-neutral-100 hover:bg-neutral-50/70`}>
      {/* Ticking the box completes the task, which is the one action worth a
          single click — and completing moves its hours into the quarter's
          achieved figure, so it is the row's most consequential control. */}
      <span className={`${CELL} justify-center`}>
        {canAssign ? (
          <button
            type="button"
            onClick={() => void patch(task.id, { state: done ? "active" : "complete" }, { state: done ? "active" : "complete" })}
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={`flex size-[15px] items-center justify-center rounded border-[1.5px] transition-colors ${
              done ? "border-success-600 bg-success-600 text-white" : "border-neutral-300 hover:border-secondary-500"
            }`}
          >
            {done && <Check className="size-2.5" strokeWidth={3} />}
          </button>
        ) : (
          <span
            className={`block size-[15px] rounded border-[1.5px] ${
              done ? "border-success-600 bg-success-600" : "border-neutral-300"
            }`}
          />
        )}
      </span>

      <span className={`${CELL} min-w-0`}>
        <span
          className={`truncate text-body-sm font-medium ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
          title={task.title}
        >
          {task.title}
        </span>
      </span>

      <span className="flex border-l border-neutral-100">
        <StatusCell task={task} canAssign={canAssign} onChange={(state) => void patch(task.id, { state }, { state })} />
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        {canAssign ? (
          <Select
            value={task.assignee?.id ?? UNASSIGNED}
            onValueChange={(v) =>
              void patch(
                task.id,
                { assignee_id: v === UNASSIGNED ? null : v },
                { assignee: team.find((m) => m.id === v) ?? null }
              )
            }
          >
            <SelectTrigger
              aria-label={`Who is doing ${task.title}`}
              className="h-auto w-full gap-1.5 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
            >
              <Owner assignee={task.assignee} capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
              {team.map((m) => {
                const cap = capacityOf.get(m.id);
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-baseline gap-2">
                      <span>
                        {m.name}
                        {m.kind === "outsourced" ? " (outsourced)" : ""}
                      </span>
                      {cap && (
                        <span className={`text-caption ${CAPACITY_CLASS[cap.tone].text}`}>{capacityShort(cap)}</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          <Owner assignee={task.assignee} capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined} />
        )}
      </span>

      <span className={`${CELL} border-l border-neutral-100`}>
        <DueDateCell
          task={task}
          canEdit={canAssign}
          onChange={(due_date) => void patch(task.id, { due_date }, { due_date })}
        />
      </span>

      <span className={`${CELL} border-l border-neutral-100`}>
        <span className={`inline-flex items-center gap-1.5 text-body-sm font-semibold ${TASK_PRIORITY_INK[task.priority]}`}>
          <Flag className="size-3.5" />
          <span className="capitalize">{task.priority}</span>
        </span>
      </span>

      <span className={`${CELL} justify-end border-l border-neutral-100`}>
        <HoursCell task={task} canEdit={canAssign} onChange={(hours) => void patch(task.id, { hours }, { hours })} />
      </span>

      <span className={`${CELL} min-w-0 border-l border-neutral-100`}>
        <span className="truncate text-caption text-neutral-500" title={task.detail ?? undefined}>
          {task.detail ?? ""}
        </span>
      </span>

      <span className={`${CELL} justify-center border-l border-neutral-100`}>
        {canDefine && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

interface RowProps {
  team: TeamMember[];
  canAssign: boolean;
  canDefine: boolean;
  capacityOf: Map<string, Capacity>;
  patch: (id: string, values: Record<string, unknown>, optimistic: Partial<Task>) => void;
  onEdit: (task: Task) => void;
}

/** Eight columns, one definition — the header and the rows share it. */
const ROW =
  "grid grid-cols-[34px_minmax(0,1.4fr)_132px_136px_120px_104px_86px_minmax(0,1fr)_46px] items-stretch";
const CELL = "flex items-center gap-2 px-2.5 py-2";
const HEAD = "text-caption font-bold uppercase tracking-wide text-neutral-400";

/** Hours read as whole numbers when they are whole ones: 12, not 12.0. */
function formatTaskHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function Owner({ assignee, capacity }: { assignee: Task["assignee"]; capacity?: Capacity }) {
  if (!assignee) {
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
          assignee.kind === "outsourced"
            ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
            : "bg-gradient-to-br from-primary-700 to-secondary-700"
        }`}
      >
        {initialsOf(assignee.name)}
      </span>
      <span className="truncate text-body-sm text-neutral-600">{assignee.name}</span>
      {/* Client-confirmed (2026-09-25): over-allocation warns, never blocks,
          so this is a marker beside the name rather than a refused save. */}
      {capacity?.over && (
        <TriangleAlert
          className="size-3.5 shrink-0 text-error-600"
          aria-label={`Over capacity — ${capacityLabel(capacity)}`}
        />
      )}
    </span>
  );
}

/**
 * The due-date cell (client-confirmed amendment, 2026-09-25).
 *
 * Editable in place by MSP Owner and Admin, alongside hours, state and
 * assignee — all four are how the work is *tracked*, which is the
 * account's to say. The same trigger enforces it, so this only decides
 * which control is drawn.
 *
 * A date that has passed on unfinished work is the one the reader needs,
 * so it stays red whether or not the cell is editable. Clearing the field
 * sets the date back to nothing, which is a real state: the client
 * confirmed due dates are wanted but not required.
 */
function DueDateCell({
  task,
  canEdit,
  onChange,
}: {
  task: Task;
  canEdit: boolean;
  onChange: (due: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.due_date ?? "");

  const done = task.state === "complete";
  const date = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
  const overdue = date !== null && !done && date < new Date(new Date().toDateString());
  const shown = date ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

  if (editing) {
    const commit = () => {
      setEditing(false);
      const next = value || null;
      if (next !== task.due_date) onChange(next);
    };
    return (
      <input
        type="date"
        autoFocus
        value={value}
        aria-label={`Due date for ${task.title}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(task.due_date ?? "");
            setEditing(false);
          }
        }}
        className="w-[118px] rounded border border-secondary-500 px-1.5 py-0.5 text-body-sm tabular-nums text-neutral-900 outline-none"
      />
    );
  }

  if (!canEdit) {
    return shown ? (
      <span className={`text-body-sm tabular-nums ${overdue ? "font-semibold text-error-700" : "text-neutral-600"}`}>
        {shown}
      </span>
    ) : (
      <span className="text-body-sm text-neutral-300">—</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(task.due_date ?? "");
        setEditing(true);
      }}
      aria-label={shown ? `Due ${shown} — click to change` : `No due date for ${task.title} — click to set one`}
      className={`rounded px-1.5 py-0.5 text-body-sm tabular-nums hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 ${
        shown ? (overdue ? "font-semibold text-error-700" : "text-neutral-600") : "text-neutral-300 hover:text-neutral-500"
      }`}
    >
      {shown ?? "—"}
    </button>
  );
}

function TaskDialog({
  accountId,
  slug,
  draft,
  setDraft,
  team,
  onClose,
}: {
  accountId: string;
  slug: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  team: TeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const finish = (message: string) => {
    setSaving(false);
    toast.success(message);
    onClose();
    router.refresh();
  };

  const fail = (error: unknown) => {
    setSaving(false);
    toast.error(getFriendlyErrorMessage(error as Parameters<typeof getFriendlyErrorMessage>[0]));
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("Give the task a title.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      account_id: accountId,
      step_slug: slug,
      title: draft.title.trim(),
      detail: draft.detail.trim() || null,
      priority: draft.priority,
      hours: Number(draft.hours) || 0,
      due_date: draft.due_date || null,
      assignee_id: draft.assignee_id === UNASSIGNED ? null : draft.assignee_id,
    };

    const { error } = draft.id
      ? await supabase.from("gos_dashboard_tasks").update(payload).eq("id", draft.id)
      : await supabase.from("gos_dashboard_tasks").insert(payload);

    if (error) return fail(error);
    finish(draft.id ? "Task updated." : "Task added.");
  };

  const archive = async () => {
    if (!draft.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (error) return fail(error);
    finish("Task removed.");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-32px)] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit task" : "Add a task"}</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            What needs doing, who is doing it, and roughly how long it takes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Label text="Title">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Label>
          <Label text="Detail">
            <Textarea
              rows={3}
              value={draft.detail}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              placeholder="What good looks like, or where to start."
            />
          </Label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Label text="Priority">
              <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as TaskPriority })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label text="Hours">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={draft.hours}
                onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
              />
            </Label>
            <Label text="Due date">
              <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            </Label>
          </div>

          <Label text="Assigned to">
            <Select value={draft.assignee_id} onValueChange={(v) => setDraft({ ...draft, assignee_id: v })}>
              <SelectTrigger>
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
          </Label>

          {team.length === 0 && (
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-caption text-neutral-500">
              Nobody is on the Company Profile rosters yet, so there is no one to assign this to.
            </p>
          )}
        </div>

        <DialogFooter className="flex-wrap justify-between">
          {draft.id ? (
            <Button variant="ghost" onClick={() => void archive()} disabled={saving} className="text-error-700">
              <Trash2 className="mr-1.5 size-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save task"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body-sm text-neutral-500">{text}</span>
      {children}
    </label>
  );
}
