import { Mail } from "lucide-react";

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

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/**
 * Client-confirmed modernization pass (approved mockup, Contact Detail
 * redesign): the Emails tab reads the same Activity rows as the
 * Activity tab (filtered to type = "email" by the caller) but gets its
 * own mail-list visual language instead of reusing the timeline's
 * chat-like cards — subject/snippet/date, the way an inbox reads.
 *
 * Client-confirmed addition (2026-09-08): each row now names an
 * explicit From (the logged-in sender, via activities.user_id) and To
 * (this contact, via activities.contact_id — both already on the row,
 * no new columns needed) and expands to the full message body, so a
 * quick-sent email (components/contacts/send-email-dialog.tsx) can be
 * reviewed in full rather than just skimmed as a snippet. This is still
 * historical activity logging, not a live inbox: there's nothing to
 * sync or reply to here.
 *
 * Same-day follow-up: when a From identity was picked at send time
 * (activities.send_from_connection_id), From shows *that* connected
 * mailbox's name/address rather than the actual sender — matching what
 * the recipient really saw, since the picked identity only changes
 * display From/Reply-To (components/contacts/send-email-dialog.tsx),
 * not who's credited internally as having sent it. Cc, when present,
 * is shown alongside To.
 */
export function EmailList({ activities, contactName, contactEmail }: { activities: ActivityRow[]; contactName: string; contactEmail: string }) {
  if (activities.length === 0) {
    return <p className="text-body text-neutral-500">No emails logged yet</p>;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200">
      {activities.map((activity, i) => {
        const sender = unwrap(activity.users);
        const pickedConnection = unwrap(activity.email_connections);
        const pickedOwner = pickedConnection ? unwrap(pickedConnection.users) : undefined;
        const fromName = pickedOwner?.full_name ?? sender?.full_name ?? "Unknown";
        const fromEmail = pickedConnection?.email_address ?? sender?.email;

        return (
          <details key={activity.id} className={"group px-4 py-3.5 " + (i > 0 ? "border-t border-neutral-100" : "")}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-caption font-semibold text-secondary-800">
                {initials(contactName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-neutral-800">
                  {activity.subject || "(no subject)"}
                </p>
                <p className="truncate text-body-sm text-neutral-500">
                  {fromName} → {contactName}
                </p>
              </div>
              <span className="shrink-0 text-caption text-neutral-400">
                {new Date(activity.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </summary>

            <div className="ml-11 mt-3 flex flex-col gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-3">
              <div className="flex items-start gap-1.5 text-caption text-neutral-500">
                <Mail className="mt-0.5 size-3 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span>
                    <span className="font-semibold text-neutral-600">From:</span> {fromName}
                    {fromEmail && <span className="text-neutral-400"> &lt;{fromEmail}&gt;</span>}
                  </span>
                  <span>
                    <span className="font-semibold text-neutral-600">To:</span> {contactName}{" "}
                    <span className="text-neutral-400">&lt;{contactEmail}&gt;</span>
                  </span>
                  {activity.cc && (
                    <span>
                      <span className="font-semibold text-neutral-600">Cc:</span>{" "}
                      <span className="text-neutral-400">{activity.cc}</span>
                    </span>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-body-sm text-neutral-700">{activity.body || "(no message)"}</p>
            </div>
          </details>
        );
      })}
      <p className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 text-caption text-neutral-400">
        Reads from the same Activity log as the Activity tab, filtered to Email — no live inbox yet.
      </p>
    </div>
  );
}
