import type { ActivityRow } from "@/components/activities/activity-timeline";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Client-confirmed modernization pass (approved mockup, Contact Detail
 * redesign): the Emails tab reads the same Activity rows as the
 * Activity tab (filtered to type = "email" by the caller) but gets its
 * own mail-list visual language instead of reusing the timeline's
 * chat-like cards — subject/snippet/date, the way an inbox reads. This
 * is still historical activity logging, not a live inbox: there's
 * nothing to open on click until real email sync exists (Milestone 10).
 */
export function EmailList({ activities, contactName }: { activities: ActivityRow[]; contactName: string }) {
  if (activities.length === 0) {
    return <p className="text-body text-neutral-500">No emails logged yet</p>;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200">
      {activities.map((activity, i) => (
        <div
          key={activity.id}
          className={
            "flex items-center gap-3 px-4 py-3.5 " + (i > 0 ? "border-t border-neutral-100" : "")
          }
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-caption font-semibold text-secondary-800">
            {initials(contactName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-neutral-800">
              {activity.subject || "(no subject)"}
            </p>
            {activity.body && <p className="truncate text-body-sm text-neutral-500">{activity.body}</p>}
          </div>
          <span className="shrink-0 text-caption text-neutral-400">
            {new Date(activity.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
      <p className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 text-caption text-neutral-400">
        Reads from the same Activity log as the Activity tab, filtered to Email — no live inbox yet.
      </p>
    </div>
  );
}
