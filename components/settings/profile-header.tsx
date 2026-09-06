import type { ReactNode } from "react";

/**
 * Design System §8.9 "Profile-style content card," Concept A (approved
 * mockup — the client tried Concept B's compact strip and preferred
 * going back to a fuller hero, just refined): a gradient banner with a
 * radial glow (same technique as the login screen's background) and a
 * large, clearly-visible avatar/logo — the client explicitly asked for
 * the record's image to read as prominent, not a small icon. Used by
 * both My Profile and Company Profile, the two screens this card
 * pattern serves, plus the Password screen's identity header.
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
    <div
      className="relative mb-5 overflow-hidden rounded-lg px-7 py-7"
      style={{
        background:
          "radial-gradient(500px circle at 88% -40%, var(--color-secondary-400) 0%, transparent 55%), linear-gradient(120deg, var(--color-primary-600), var(--color-secondary-600))",
      }}
    >
      <div className="relative z-10 flex items-center gap-5">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-white/70 bg-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]">
          {avatar}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-h3 text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-body-sm text-white/70">{subtitle}</p>}
          {badge && (
            <span className="mt-2.5 inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-caption font-semibold text-white">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
