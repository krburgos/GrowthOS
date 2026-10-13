"use client";

import { Info, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * What a figure means, on demand (client-confirmed, 2026-10-13): the
 * Mission Capacity and Mission Progress figures carry only a label and a
 * number, and the explanation that used to sit under each one opens from
 * this icon instead.
 *
 * Hover and keyboard focus open it through Radix as usual. Click toggles
 * it too, because a touch screen has no hover and the tooltip would
 * otherwise be unreachable there.
 *
 * "warning" is the shortfall flag: an amber disc beside a figure that is
 * short of what is required, explained the same way.
 */
export function InfoTip({
  text,
  label,
  tone = "info",
  className = "",
}: {
  text: string;
  /** Accessible name, e.g. "About Hours required". */
  label: string;
  tone?: "info" | "warning";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const warning = tone === "warning";
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={
            warning
              ? `inline-flex size-[22px] shrink-0 cursor-help items-center justify-center rounded-full bg-warning-100 text-warning-800 transition-colors hover:bg-warning-400 hover:text-warning-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 ${className}`
              : `inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-neutral-300 transition-colors hover:text-secondary-800 focus-visible:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 ${className}`
          }
        >
          {warning ? <TriangleAlert className="size-3.5" /> : <Info className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-center font-medium normal-case tracking-normal">{text}</TooltipContent>
    </Tooltip>
  );
}
