import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design System §8.1 — Buttons.
 * Variants: Primary, Secondary, Destructive, Ghost, Link.
 * Sizes: sm (28px), md (36px, default), lg (44px, Onboarding Wizard CTA only).
 *
 * Ghost's hover fill is spec'd as neutral-100 — bumped to neutral-200 (plus
 * an added neutral-300 active state) for the same reason as the Badge fills
 * (components/ui/badge.tsx): neutral-100 reads as barely visible against a
 * white/neutral-50 surface. Confirmed with the client.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-950",
        secondary:
          "bg-white text-primary-700 border border-neutral-300 hover:border-primary-700 hover:text-primary-800 active:bg-neutral-50",
        destructive: "bg-error-600 text-white hover:bg-error-700 active:bg-error-800",
        ghost: "bg-transparent text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300",
        link: "bg-transparent text-primary-700 hover:underline underline-offset-2",
      },
      size: {
        sm: "h-7 px-3",
        md: "h-9 px-4",
        lg: "h-11 px-5",
      },
    },
    compoundVariants: [
      { variant: "link", size: "sm", class: "h-auto px-0" },
      { variant: "link", size: "md", class: "h-auto px-0" },
      { variant: "link", size: "lg", class: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
