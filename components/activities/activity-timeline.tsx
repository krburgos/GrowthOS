"use client";

import { Calendar, CheckSquare, Mail, Phone, StickyNote, Users as UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";

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

/**
 * PRD §6.5 — unified activity timeline, chronological, shared between
 * Contact Detail and Opportunity Detail.
 */
export function ActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  const router = useRouter();

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

  if (activities.length === 0) {
    return <p className="text-body text-neutral-500">No activity yet</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {activities.map((activity) => {
        const Icon = TYPE_ICON[activity.type];
        const author = Array.isArray(activity.users) ? activity.users[0] : activity.users;

        return (
          <li key={activity.id} className="flex gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Icon className="size-4" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {activity.type === "task" && (
                  <Checkbox
                    checked={!!activity.completed_at}
                    onCheckedChange={() => toggleComplete(activity)}
                    aria-label="Mark task complete"
                  />
                )}
                <span className="text-body font-medium text-neutral-800">
                  {activity.subject || activity.type[0].toUpperCase() + activity.type.slice(1)}
                </span>
              </div>
              {activity.body && <p className="text-body-sm text-neutral-600">{activity.body}</p>}
              <p className="text-body-sm text-neutral-400">
                {author?.full_name ?? "Unknown"} · {new Date(activity.occurred_at).toLocaleString()}
                {activity.due_at && <> · Due {new Date(activity.due_at).toLocaleDateString()}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
