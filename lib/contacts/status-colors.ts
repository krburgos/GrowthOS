/**
 * Contact status colors (client-confirmed, 2026-10-14, approved mockup
 * "Status Colors"; Design System §8.3 amendment). A status stores a swatch
 * key in contact_statuses.color, never a free hex, so every pill is one of
 * these contrast-checked tints (all 4.5:1 or better) and sits quietly in
 * the tables. The database check constraint lists the same keys.
 *
 * Class strings are written out in full so Tailwind can see them.
 */
export const STATUS_COLORS = {
  gray: { label: "Gray", pill: "bg-neutral-200 text-neutral-700" },
  navy: { label: "Navy", pill: "bg-primary-100 text-primary-700" },
  blue: { label: "Blue", pill: "bg-primary-200 text-primary-900" },
  cyan: { label: "Cyan", pill: "bg-secondary-100 text-secondary-800" },
  teal: { label: "Teal", pill: "bg-secondary-200 text-secondary-900" },
  green: { label: "Green", pill: "bg-success-100 text-success-800" },
  lime: { label: "Lime", pill: "bg-success-200 text-success-900" },
  yellow: { label: "Yellow", pill: "bg-warning-100 text-warning-900" },
  gold: { label: "Gold", pill: "bg-warning-200 text-warning-950" },
  orange: { label: "Orange", pill: "bg-orange-100 text-orange-800" },
  red: { label: "Red", pill: "bg-error-100 text-error-700" },
  rose: { label: "Rose", pill: "bg-error-200 text-error-800" },
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;

export const STATUS_COLOR_KEYS = Object.keys(STATUS_COLORS) as StatusColor[];

/** Gray for anything missing or unknown, so a pill always renders. */
export function statusPillClass(color: string | null | undefined): string {
  return (STATUS_COLORS[color as StatusColor] ?? STATUS_COLORS.gray).pill;
}
