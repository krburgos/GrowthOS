"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field with a show/hide toggle (client-confirmed, 2026-09-25).
 *
 * Wraps the Design System §8.2 Input rather than restyling it, so the
 * border, height, focus ring and error state stay in one place. The toggle
 * sits inside the field's right padding; `pr-10` keeps the value from
 * running underneath it.
 *
 * The button is `type="button"` on purpose — inside a form, a button
 * without it defaults to submit, so revealing the password would post the
 * login.
 *
 * The toggle is in the tab order. Taking it out would make the form flow
 * marginally quicker for a mouse user and leave a keyboard user unable to
 * reveal what they typed at all, which is the one group the feature helps
 * most. It announces its next action ("Show password" / "Hide password")
 * rather than its current state, which is what someone hears just before
 * pressing it.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
