import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Design System §8.2 — Form Fields.
 * 36px height, radius-md, 1px neutral-300 border, neutral-50 bg when disabled.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "flex h-9 w-full rounded-md border bg-white px-3 py-2 text-body text-neutral-800 placeholder:text-neutral-400 transition-colors",
          "border-neutral-300 focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2",
          error && "border-error-600",
          disabled && "bg-neutral-50 opacity-40 cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
