import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Design System §8.11 — Loading & Empty States. Spinner, not skeleton
 * screens, per the confirmed direction.
 */
export function Spinner({
  size = "inline",
  className,
}: {
  size?: "inline" | "page";
  className?: string;
}) {
  return (
    <Loader2
      className={cn(
        "animate-spin text-primary-700",
        size === "inline" ? "size-6" : "size-10",
        className
      )}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner size="page" />
    </div>
  );
}
