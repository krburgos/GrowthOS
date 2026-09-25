"use client";

import { Check, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
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
  TASK_PRIORITY_GROUPS,
  TASK_STATES,
  TASK_STATE_CELL,
  TASK_STATE_LABEL,
  taskSummary,
  type Task,
  type TaskPriority,
  type TaskState,
} from "@/lib/gos-dashboard/tasks";
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

/**
 * "What to do next" — a workstream's tasks as a board (client-confirmed,
 * 2026-09-25, grouped rows over kanban).
 *
 * Rows are grouped by priority, so the board reads top to bottom as an
 * order of work. State stays a column rather than becoming the grouping,
 * which is what a kanban would have done: hours, owner and due date all
 * need to be readable at a glance, and a kanban card hides them.
 *
 * Assigning is the main verb here, so state and assignee are changed
 * inline. The dialog is only for defining the work, which is CRO Leader's
 * job.
 *
 * `canAssign` and `canDefine` mirror the database, they do not stand in
 * for it: a trigger rejects any non-CRO change to a task's title, detail,
 * priority, hours or due date, so hiding the controls is courtesy rather
 * than the guard.
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
  // The board keeps its own copy of the rows so an inline change lands the
  // instant it is clicked. Waiting for the write and then re-rendering the
  // whole server page - which is what this did before - put a visible dead
  // beat between the click and the colour changing.
  const [rows, setRows] = useState(tasks);
  useEffect(() => setRows(tasks), [tasks]);
  const summary = taskSummary(rows);

  /**
   * Applies the change locally first, then writes. On failure the row goes
   * back to what it was and says so; nothing is left showing a value the
   * database rejected.
   *
   * The refresh on success is still worth doing but no longer blocks
   * anything visible: completing a task moves the workstream's achieved
   * hours through a database trigger, so the Hours panel above this board
   * has to catch up.
   */
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

  // Capacity is per person, not per row, so it is worked out once here and
  // read by every row that names them.
  const capacityOf = new Map<string, Capacity>(
    team.map((m) => [m.id, capacityFor(m.weekly_hours, memberLoad[m.id] ?? 0)])
  );

  const groups = TASK_PRIORITY_GROUPS.map((g) => ({
    ...g,
    items: rows.filter((t) => t.priority === g.value),
  })).filter((g) => g.items.length > 0);

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
            ? "Add the first task once the status report says what needs fixing."
            : "CRO Leader has not set any tasks for this workstream yet."}
        </p>
      ) : (
        /* The board scrolls sideways rather than dropping columns: an owner
           or a due date you cannot see is the reason a task gets missed. */
        <div className="overflow-x-auto px-5 py-5">
          <div className="min-w-[768px]">
            {groups.map((group) => {
              const groupHours = group.items.reduce((sum, t) => sum + t.hours, 0);
              return (
                <div key={group.value} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2.5 pb-2 pl-3.5">
                    <h3 className={`text-body font-bold ${group.text}`}>{group.label}</h3>
                    <span className="text-body-sm text-neutral-500">
                      {group.items.length} {group.items.length === 1 ? "task" : "tasks"}
                    </span>
                    <span className="ml-auto text-body-sm tabular-nums text-neutral-500">
                      {formatTaskHours(groupHours)} hrs
                    </span>
                  </div>

                  <div className={`overflow-hidden rounded-md border border-l-4 border-neutral-200 ${group.bar}`}>
                    <div className={`${ROW} bg-neutral-50`}>
                      <div className={`${CELL} py-2.5 ${HEAD}`}>Task</div>
                      <div className={`${CELL} py-2.5 ${HEAD}`}>Owner</div>
                      <div className={`${CELL} justify-center py-2.5 ${HEAD}`}>Status</div>
                      <div className={`${CELL} py-2.5 ${HEAD}`}>Due</div>
                      <div className={`${CELL} justify-center py-2.5 ${HEAD}`}>Hrs</div>
                    </div>

                    {group.items.map((task) => (
                      <div key={task.id} className={`${ROW} border-t border-neutral-100`}>
                        <div className={`${CELL} min-w-0 flex-col items-start gap-0`}>
                          <span
                            className={`max-w-full truncate text-body-sm font-semibold ${
                              task.state === "complete" ? "text-neutral-400 line-through" : "text-neutral-900"
                            }`}
                            title={task.title}
                          >
                            {task.title}
                          </span>
                          {task.detail && (
                            <span className="max-w-full truncate text-caption text-neutral-500" title={task.detail}>
                              {task.detail}
                            </span>
                          )}
                        </div>

                        <div className={`${CELL} min-w-0`}>
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
                                <Owner
                                  assignee={task.assignee}
                                  capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined}
                                />
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
                                          <span className={`text-caption ${CAPACITY_CLASS[cap.tone].text}`}>
                                            {capacityShort(cap)}
                                          </span>
                                        )}
                                      </span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Owner
                              assignee={task.assignee}
                              capacity={task.assignee ? capacityOf.get(task.assignee.id) : undefined}
                            />
                          )}
                        </div>

                        {/* Monday's tell: the status fills its whole cell. */}
                        <div className="flex">
                          <StatusCell
                            task={task}
                            canAssign={canAssign}
                            onChange={(state) => void patch(task.id, { state }, { state })}
                          />
                        </div>

                        <div className={CELL}>
                          <DueDateCell
                            task={task}
                            canEdit={canAssign}
                            onChange={(due_date) => void patch(task.id, { due_date }, { due_date })}
                          />
                        </div>

                        <div className={`${CELL} justify-center gap-1`}>
                          <HoursCell
                            task={task}
                            canEdit={canAssign}
                            onChange={(hours) => void patch(task.id, { hours }, { hours })}
                          />
                          {canDefine && (
                            <button
                              type="button"
                              onClick={() => setDraft(editDraft(task))}
                              aria-label={`Edit ${task.title}`}
                              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {canDefine && (
                      <button
                        type="button"
                        onClick={() => setDraft({ ...emptyDraft(), priority: group.value })}
                        className="w-full border-t border-dashed border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-left text-body-sm text-neutral-400 hover:text-secondary-700"
                      >
                        + Add task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

/**
 * The status cell (client-confirmed, 2026-09-25, "status palette").
 *
 * A colour palette rather than a Select: one click opens it, one more
 * sets the state. The Select that was here before was a form control
 * doing a board cell's job — it carried a chevron and a listbox, and it
 * read as something you fill in rather than something you flip.
 *
 * The popover portals, so the group's rounded overflow-hidden frame
 * cannot clip it.
 */
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

/** Five columns, one definition — the header row and the data rows share it. */
const ROW = "grid grid-cols-[minmax(0,1fr)_128px_128px_132px_78px] items-stretch";
const CELL = "flex items-center gap-2 px-3.5 py-2.5";
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
