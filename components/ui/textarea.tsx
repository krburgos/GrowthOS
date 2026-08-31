import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Design System §8.2 — Form Fields (textarea: 3-line minimum height,
 * resizable vertically only).
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "flex min-h-18 w-full resize-y rounded-md border bg-white px-3 py-2 text-body text-neutral-800 placeholder:text-neutral-400 transition-colors",
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
Textarea.displayName = "Textarea";

export { Textarea };
