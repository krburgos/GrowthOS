import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The type scale in docs/design-system.md §9 uses custom names — text-display,
 * text-h1, text-body-sm, text-caption and so on. tailwind-merge does not know
 * those are font sizes, so out of the box it files them under text *colour*,
 * and cn("text-h1 ...", "text-primary-900") silently drops the size: the
 * element then renders at whatever size it inherits.
 *
 * That bug was live across roughly eighty call sites (found 2026-09-22 via
 * the GOS Dashboard's KPI figures, which were written as text-h2 and
 * rendering at body size). Teaching the merger the scale fixes all of them at
 * once, and means a size and a colour can safely meet in the same cn() call
 * again, as every component here already assumes.
 *
 * Keep this list in step with the @theme block in app/globals.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "h1", "h2", "h3", "h4", "body-lg", "body", "body-sm", "caption", "button"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
