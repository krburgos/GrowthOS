import { TYPE_ICON, TYPE_ICON_BG, type ActivityType } from "@/lib/activities/type-icon";
import { cn } from "@/lib/utils";

export interface FeedItem {
  id: string;
  type: ActivityType;
  subject: string | null;
  who: string;
  occurred_at: string;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** App Flow §4.3 — "recent calls, emails, status changes across the account." */
export function RecentActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">Recent Activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-body-sm text-neutral-500">No activity yet.</p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto">
          {items.map((item, i) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <div key={item.id} className={cn("flex items-start gap-3 px-4 py-3", i > 0 && "border-t border-neutral-100")}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-white",
                    TYPE_ICON_BG[item.type]
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-neutral-800">
                    {item.subject || item.type[0].toUpperCase() + item.type.slice(1)}
                  </p>
                  <p className="truncate text-caption text-neutral-500">{item.who}</p>
                </div>
                <span className="shrink-0 text-caption text-neutral-400">{relativeTime(item.occurred_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
