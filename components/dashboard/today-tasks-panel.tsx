"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface DueTask {
  id: string;
  subject: string | null;
  due_at: string;
  who: string;
}

function dueBucket(dueAt: string): { label: string; className: string } {
  const due = new Date(dueAt);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(due) - startOfDay(today)) / 86400000);

  if (diffDays < 0) return { label: "Overdue", className: "bg-error-100 text-error-700" };
  if (diffDays === 0) return { label: "Today", className: "bg-warning-400 text-neutral-800" };
  if (diffDays === 1) return { label: "Tomorrow", className: "bg-neutral-100 text-neutral-600" };
  return {
    label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    className: "bg-neutral-100 text-neutral-600",
  };
}

/**
 * Client-confirmed addition (2026-09-08) — Concept B's "Today" rail,
 * approved over the spec's literal top-of-page task list (App Flow
 * §4.3) as a deliberate reinterpretation: still the first thing the eye
 * lands on, via a permanently visible highlighted panel instead of
 * document order. Completing a task here uses the same
 * completed_at-toggle mutation as the Activity tab's timeline
 * (components/activities/activity-timeline.tsx).
 */
export function TodayTasksPanel({ tasks }: { tasks: DueTask[] }) {
  const router = useRouter();

  const complete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("activities")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-secondary-200 bg-secondary-50">
      <div className="flex items-center justify-between border-b border-secondary-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">Today</h2>
        <span className="text-caption text-neutral-500">{tasks.length} due</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-body-sm text-neutral-500">Nothing due — you&apos;re all caught up.</p>
      ) : (
        tasks.map((task, i) => {
          const bucket = dueBucket(task.due_at);
          return (
            <div
              key={task.id}
              className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-secondary-100")}
            >
              <Checkbox
                aria-label={`Mark "${task.subject ?? "task"}" complete`}
                onCheckedChange={() => complete(task.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-neutral-800">{task.subject || "Task"}</p>
                <p className="truncate text-caption text-neutral-500">{task.who}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold", bucket.className)}>
                {bucket.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
