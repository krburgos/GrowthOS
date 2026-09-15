import { ROLE_LABELS } from "@/lib/auth/role-labels";
import type { UserRole } from "@/lib/auth/get-current-user";
import { LogoutButton } from "@/components/auth/logout-button";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Client-confirmed redesign (2026-09-15, approved mockup "Concept B —
 * role pill" restyled onto a light bar): the CRO Leader / Partner
 * Dashboard is a distinct "admin" surface from the MSP shell, so it
 * gets its own static header instead of the shared white `TopBar` — no
 * bell (it had no real account context to notify about here) and no
 * avatar circle, just who's signed in as a role pill and a plain Log
 * Out control.
 *
 * First pass put this bar on primary-900 with the logo in a white
 * chip — client feedback (2026-09-15): the chip read as a sticker
 * stuck on a dark box. Moved to a near-white bar instead, so the real
 * logo sits directly on it (Design System §2's "white/near-white
 * backgrounds only" rule, no chip or new asset needed).
 *
 * Client feedback, round two (2026-09-15): dropped the "CRO Leader
 * Dashboard" / "Partner Dashboard" tag from the header (the page's own
 * h1 already says this one row down) in favor of a bigger, centered
 * logo as the header's sole focal point. A 3-column grid (equal 1fr
 * side columns) keeps the logo mathematically centered regardless of
 * what either side column holds.
 *
 * Client feedback, round three (2026-09-15): moved the role pill from
 * the right side to the left, leaving Log Out alone on the right.
 */
export function CroHeader({
  fullName,
  role,
}: {
  fullName: string;
  role: UserRole;
}) {
  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 bg-neutral-50 px-4 py-3 shadow-[0_1px_0_var(--color-neutral-200),0_6px_16px_-12px_rgba(10,25,46,0.15)]">
      <div className="flex items-center">
        <span className="flex items-center gap-2 rounded-full bg-primary-50 py-1 pl-1 pr-3 text-body-sm">
          <span className="flex size-6 items-center justify-center rounded-full bg-secondary-500 text-[11px] font-semibold text-primary-900">
            {initials(fullName)}
          </span>
          <span className="font-semibold text-primary-900">{fullName}</span>
          <span className="text-primary-700/70">· {ROLE_LABELS[role]}</span>
        </span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/growthos-logo.png" alt="GrowthOS" className="h-14 w-auto justify-self-center" />

      <div className="flex items-center justify-end">
        <LogoutButton />
      </div>
    </header>
  );
}
