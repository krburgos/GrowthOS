"use client";

import { CheckSquare, Mail, Phone, StickyNote, Users as UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface ActivityRow {
  id: string;
  type: "call" | "email" | "meeting" | "task" | "note";
  subject: string | null;
  body: string | null;
  occurred_at: string;
  due_at: string | null;
  completed_at: string | null;
  users: { full_name: string } | { full_name: string }[] | null;
}

const TYPE_ICON = {
  call: Phone,
  email: Mail,
  meeting: UsersIcon,
  task: CheckSquare,
  note: StickyNote,
} as const;

const TYPE_ICON_BG: Record<ActivityRow["type"], string> = {
  call: "bg-primary-500",
  email: "bg-secondary-500",
  meeting: "bg-success-600",
  task: "bg-warning-700",
  note: "bg-neutral-400",
};

const TYPE_FILTERS: { value: "all" | ActivityRow["type"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "meeting", label: "Meetings" },
  { value: "task", label: "Tasks" },
  { value: "note", label: "Notes" },
];

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/**
 * PRD §6.5 — unified activity timeline, chronological, shared between
 * Contact Detail and Opportunity Detail.
 *
 * Client-confirmed modernization pass (approved mockup, Contact Detail
 * redesign): date-grouped headers (Today/Yesterday/date), a connecting
 * vertical line between entries, a colored icon chip per activity type
 * (rather than one neutral circle for everything), and a type filter
 * row so a long history can be narrowed to one kind of activity.
 */
export function ActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ActivityRow["type"]>("all");

  const filtered = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const activity of filtered) {
      const label = dayLabel(activity.occurred_at);
      const existing = map.get(label) ?? [];
      existing.push(activity);
      map.set(label, existing);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggleComplete = async (activity: ActivityRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("activities")
      .update({ completed_at: activity.completed_at ? null : new Date().toISOString() })
      .eq("id", activity.id);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-caption font-medium transition-colors",
              filter === f.value
                ? "border-primary-800 bg-primary-800 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-primary-700 hover:text-primary-800"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-body text-neutral-500">No activity yet</p>
      ) : (
        <div>
          {groups.map(([label, dayActivities]) => (
            <div key={label}>
              <p className="mb-2.5 mt-5 pl-11 text-caption font-semibold uppercase tracking-wide text-neutral-400 first:mt-0">
                {label}
              </p>
              <ul className="flex flex-col">
                {dayActivities.map((activity, i) => {
                  const Icon = TYPE_ICON[activity.type];
                  const author = Array.isArray(activity.users) ? activity.users[0] : activity.users;
                  const isLast = i === dayActivities.length - 1;

                  return (
                    <li key={activity.id} className="relative flex gap-3 pb-4">
                      {!isLast && (
                        <span className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2 bg-neutral-200" />
                      )}
                      <div
                        className={cn(
                          "z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white",
                          TYPE_ICON_BG[activity.type]
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-body font-medium text-neutral-800">
                            {activity.type === "task" && (
                              <Checkbox
                                checked={!!activity.completed_at}
                                onCheckedChange={() => toggleComplete(activity)}
                                aria-label="Mark task complete"
                              />
                            )}
                            {activity.subject || activity.type[0].toUpperCase() + activity.type.slice(1)}
                          </span>
                          <span className="shrink-0 text-caption text-neutral-400">
                            {activity.due_at
                              ? `Due ${new Date(activity.due_at).toLocaleDateString()}`
                              : new Date(activity.occurred_at).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                          </span>
                        </div>
                        {activity.body && <p className="text-body-sm text-neutral-600">{activity.body}</p>}
                        <p className="mt-1 text-caption text-neutral-400">{author?.full_name ?? "Unknown"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
