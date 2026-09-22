import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * KNOWN LIMITATION (found 2026-09-22): the type scale in
 * docs/design-system.md §9 uses custom names - text-display, text-h1,
 * text-body-sm, text-caption and so on - and tailwind-merge does not
 * recognise those as font sizes. It files them under text colour instead,
 * so cn("text-h1 ...", "text-primary-900") drops the size and the element
 * renders at whatever size it inherits.
 *
 * Until cn() is taught the scale via extendTailwindMerge, do not pass a
 * custom text size and a text colour through the same cn() call - build
 * that class string by concatenation instead.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
