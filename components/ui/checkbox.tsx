import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Design System §8.5 — Tables: "secondary-800 checkbox" for selected
 * rows. radius-sm per §6.1 ("Checkboxes, small badges").
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "flex size-4 shrink-0 items-center justify-center rounded-sm border border-neutral-300 bg-white",
      "data-[state=checked]:border-secondary-800 data-[state=checked]:bg-secondary-800",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
      <Check className="size-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
