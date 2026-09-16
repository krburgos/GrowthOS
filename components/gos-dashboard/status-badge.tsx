import { STATUS_LABEL, type PlaybookStatus } from "@/lib/gos-dashboard/playbook";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<PlaybookStatus, string> = {
  on_track: "bg-success-100 text-success-700",
  ahead: "bg-secondary-100 text-secondary-700",
  needs_attention: "bg-warning-100 text-warning-700",
};

export function StatusBadge({ status }: { status: PlaybookStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold", STATUS_CLASSES[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
