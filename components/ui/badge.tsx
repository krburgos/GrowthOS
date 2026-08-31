import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design System §8.3 — Badges / Status Pills.
 * Four semantic categories; custom statuses default to "neutral" (§8.3 note).
 *
 * §8.3's literal fills (neutral-100, secondary-50, success-50-equivalent,
 * error-50-equivalent) carry ~1.06–1.3:1 contrast against white per their
 * own §3 tables — documented as "backgrounds only" washes, not meant to
 * read as a standalone pill. Confirmed with the client that this reads as
 * too low-contrast against the white card surface in practice; bumped each
 * fill one step darker (still within the already-defined scale, text
 * colors unchanged) rather than left as spec'd.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full text-caption px-2.5 py-1",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-200 text-neutral-700",
        info: "bg-secondary-100 text-secondary-800",
        success: "bg-success-100 text-success-800",
        error: "bg-error-100 text-error-700",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
