import type { ReactNode } from "react";

/**
 * Design System §8.9 "Profile-style content card," Concept B (approved
 * mockup, replacing the original tall gradient hero + overlapping
 * avatar): a slim navy strip instead — the client felt the hero spent
 * too much of a settings screen (visited for seconds, not lingered on)
 * on decoration. Used by both My Profile and Company Profile, the two
 * screens this card pattern serves.
 */
export function ProfileHeader({
  title,
  subtitle,
  badge,
  avatar,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  avatar: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-4 rounded-lg bg-gradient-to-r from-primary-900 to-primary-800 px-6 py-5">
      <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-white/10">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h4 text-white">{title}</h1>
        {subtitle && <p className="truncate text-body-sm text-white/60">{subtitle}</p>}
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-caption font-semibold text-white">
          {badge}
        </span>
      )}
    </div>
  );
}
