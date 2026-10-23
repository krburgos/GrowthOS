import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The warning on every campaign screen while CAMPAIGNS_PAUSED is on
 * (client-confirmed, 2026-10-23). Same warning band as the Lists section's
 * "ICP isn't finished" notice. `flush` drops the rounded border for use
 * inside a section frame.
 */
export function CampaignsPausedNotice({ flush = false }: { flush?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 bg-warning-100 px-5 py-3 text-body-sm text-warning-900",
        flush ? "border-b border-warning-300" : "rounded-lg border border-warning-300"
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-800" aria-hidden="true" />
      <p>
        <span className="font-semibold">Email campaigns are still in progress.</span> They aren&apos;t working yet, so
        creating and sending campaigns is turned off for now. We&apos;ll let you know when they&apos;re ready.
      </p>
    </div>
  );
}
