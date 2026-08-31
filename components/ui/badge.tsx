import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design System §8.3 — Badges / Status Pills.
 * Four semantic categories; custom statuses default to "neutral" (§8.3 note).
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full text-caption px-2.5 py-1",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-100 text-neutral-700",
        info: "bg-secondary-50 text-secondary-800",
        success: "bg-success-50 text-success-800",
        error: "bg-error-50 text-error-700",
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
