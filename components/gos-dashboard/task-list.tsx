"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  TASK_PRIORITY_CLASS,
  TASK_STATES,
  TASK_STATE_CLASS,
  TASK_STATE_LABEL,
  taskSummary,
  type Task,
  type TaskPriority,
  type TaskState,
} from "@/lib/gos-dashboard/tasks";
import { createClient } from "@/lib/supabase/client";
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
 * "What to do next" — a workstream's tasks (client-confirmed, 2026-09-25).
 *
 * Assigning is the main verb on this page, so state and assignee are
 * changed inline rather than in a dialog. The dialog is only for defining
 * the work, which is CRO Leader's job.
 *
 * `canAssign` and `canDefine` mirror the database, they do not stand in for
 * it: a trigger rejects any non-CRO change to a task's title, detail,
 * priority, hours or due date, so hiding the controls is courtesy rather
 * than the guard.
 */
export function TaskList({
  accountId,
  slug,
  tasks,
  team,
  canAssign,
  canDefine,
}: {
  accountId: string;
  slug: string;
  tasks: Task[];
  team: TeamMember[];
  canAssign: boolean;
  canDefine: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const summary = taskSummary(tasks);

  const patch = async (id: string, values: Record<string, unknown>) => {
    setBusy(id);
    const supabase = createClient();
    const { error } = await supabase.from("gos_dashboard_tasks").update(values).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-h4 text-primary-900">What to do next</h2>
          <p className="mt-0.5 text-body-sm text-neutral-500">
            {tasks.length === 0
              ? "No tasks yet."
              : `${summary.total} ${summary.total === 1 ? "task" : "tasks"} from the report above. Assign each to someone and set the hours it will take.`}
          </p>
        </div>
        {canDefine && (
          <Button size="sm" className="ml-auto" onClick={() => setDraft(emptyDraft())}>
            <Plus className="mr-1.5 size-4" />
            Add task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          {canDefine
            ? "Add the first task once the status report says what needs fixing."
            : "CRO Leader has not set any tasks for this workstream yet."}
        </p>
      ) : (
        <ul>
          {tasks.map((task) => {
            const done = task.state === "complete";
            return (
              <li key={task.id} className="border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  {canAssign ? (
                    <Select
                      value={task.state}
                      onValueChange={(state) => void patch(task.id, { state: state as TaskState })}
                      disabled={busy === task.id}
                    >
                      <SelectTrigger
                        aria-label={`State of ${task.title}`}
                        className={`h-auto w-auto shrink-0 gap-1.5 rounded-md border-0 px-2.5 py-1 text-caption font-bold ${TASK_STATE_CLASS[task.state]}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className={`shrink-0 rounded-md px-2.5 py-1 text-caption font-bold ${TASK_STATE_CLASS[task.state]}`}
                    >
                      {TASK_STATE_LABEL[task.state]}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className={`text-body font-semibold leading-snug ${done ? "text-neutral-400 line-through" : "text-neutral-800"}`}>
                      {task.title}
                    </p>
                    {task.detail && <p className="mt-1 max-w-[72ch] text-body-sm leading-relaxed text-neutral-500">{task.detail}</p>}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-caption font-bold capitalize ${TASK_PRIORITY_CLASS[task.priority]}`}>
                        {task.priority}
                      </span>

                      {canAssign ? (
                        <Select
                          value={task.assignee?.id ?? UNASSIGNED}
                          onValueChange={(value) =>
                            void patch(task.id, { assignee_id: value === UNASSIGNED ? null : value })
                          }
                          disabled={busy === task.id}
                        >
                          <SelectTrigger
                            aria-label={`Who is doing ${task.title}`}
                            className="h-8 w-auto gap-2 rounded-full border-neutral-200 py-0 pl-1.5 pr-3 text-body-sm font-medium"
                          >
                            {task.assignee ? (
                              <span className="flex items-center gap-2">
                                <span
                                  className={`flex size-[22px] items-center justify-center rounded-full text-[8.5px] font-bold text-white ${
                                    task.assignee.kind === "outsourced"
                                      ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
                                      : "bg-gradient-to-br from-primary-700 to-secondary-700"
                                  }`}
                                >
                                  {initialsOf(task.assignee.name)}
                                </span>
                                {task.assignee.name}
                              </span>
                            ) : (
                              <span className="px-1 text-neutral-400">Assign someone</span>
                            )}
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
                        <span className="text-body-sm text-neutral-500">
                          {task.assignee ? task.assignee.name : "Unassigned"}
                        </span>
                      )}

                      <span className="rounded-md border border-neutral-200 px-2.5 py-1 text-body-sm text-neutral-700">
                        <b className="font-bold text-primary-900">{task.hours}</b> hrs
                      </span>

                      {task.due_date && (
                        <span className="text-body-sm text-neutral-400">
                          Due {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </span>
                      )}

                      {canDefine && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              id: task.id,
                              title: task.title,
                              detail: task.detail ?? "",
                              priority: task.priority,
                              hours: String(task.hours),
                              due_date: task.due_date ?? "",
                              assignee_id: task.assignee?.id ?? UNASSIGNED,
                            })
                          }
                          className="text-body-sm font-semibold text-secondary-700 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-body-sm text-neutral-600">
          <span>
            <b className="font-bold text-primary-900">{summary.hours} hrs</b> across {summary.total}{" "}
            {summary.total === 1 ? "task" : "tasks"}
            {summary.unassigned > 0 && (
              <>
                {" · "}
                <b className="font-bold text-warning-800">{summary.unassigned}</b> unassigned
              </>
            )}
          </span>
          <span className="ml-auto">
            {summary.done} of {summary.total} complete
          </span>
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
