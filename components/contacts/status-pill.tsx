import { statusPillClass } from "@/lib/contacts/status-colors";
import { cn } from "@/lib/utils";

/**
 * A contact status, in the color chosen for it in Settings › Contact
 * Statuses (client-confirmed, 2026-10-14, "Status Colors"). Used everywhere
 * a status shows, so one setting changes every pill.
 */
export function StatusPill({
  name,
  color,
  className,
}: {
  name: string;
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold",
        statusPillClass(color),
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-85" />
      {name}
    </span>
  );
}
