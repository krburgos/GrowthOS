import { CheckSquare, Mail, Phone, StickyNote, Users as UsersIcon } from "lucide-react";

/**
 * Bug fix (2026-09-08): this used to live inline inside
 * activity-timeline.tsx, which is "use client" — every export of a
 * client module becomes a client reference, so a Server Component
 * (components/dashboard/recent-activity-feed.tsx) importing these
 * constants from there rendered a broken reference instead of the real
 * icon component ("TypeError: n is not a function" in production,
 * where dev's looser resolution had masked it). Pulling the plain,
 * boundary-neutral constants out here — no "use client" needed, since
 * lucide-react icons themselves work in both server and client
 * components — lets both the client timeline and the server-rendered
 * dashboard feed import the same values safely.
 */
export type ActivityType = "call" | "email" | "meeting" | "task" | "note";

export const TYPE_ICON = {
  call: Phone,
  email: Mail,
  meeting: UsersIcon,
  task: CheckSquare,
  note: StickyNote,
} as const;

export const TYPE_ICON_BG: Record<ActivityType, string> = {
  call: "bg-primary-500",
  email: "bg-secondary-500",
  meeting: "bg-success-600",
  task: "bg-warning-700",
  note: "bg-neutral-400",
};
