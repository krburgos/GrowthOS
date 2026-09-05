import type { ReactNode } from "react";

/**
 * Design System §8.9 "Profile-style content card" — gradient banner +
 * overlapping circular avatar/logo, used by Company Profile and My
 * Profile only (the two Settings screens that are a single record's
 * fields, not a list/table).
 */
export function ProfileBanner({ title, avatar }: { title: string; avatar: ReactNode }) {
  return (
    <div className="mb-10 rounded-t-lg bg-gradient-to-r from-primary-600 to-secondary-500 px-6 pb-2 pt-6">
      <div className="flex items-end gap-4">
        <div className="flex size-16 shrink-0 translate-y-8 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white">
          {avatar}
        </div>
        <h1 className="pb-1 text-h3 text-white">{title}</h1>
      </div>
    </div>
  );
}
