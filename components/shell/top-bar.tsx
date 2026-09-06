"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/shell/command-palette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavAccess, NavSection } from "@/lib/auth/nav-permissions";
import { createClient } from "@/lib/supabase/client";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Design System §8.10 — Top Bar. White bg, 1px neutral-200 bottom
 * border, 56px height, logo left, bell + user menu right.
 *
 * Client-confirmed modernization pass (approved mockup): a subtle
 * shadow instead of a flat border, and a teal avatar ring to match the
 * rest of the app's "teal = focus/active" language.
 *
 * Impeccable critique finding (2026-09-06, P2): the bell briefly grew a
 * hardcoded "unread" dot with no real state behind it — a persistently
 * lying indicator that would train users to ignore it. Removed until an
 * actual unread-notifications source exists to drive it honestly.
 *
 * Client-confirmed redesign, round two (approved mockup, "Concept B —
 * Command Palette"): the disabled Contacts-search field — dead chrome
 * for a feature that was never wired up — is replaced by
 * `CommandPalette`, a Cmd/Ctrl+K launcher that jumps to recent
 * contacts, quick actions, and app sections instead. The logo also
 * grew from h-10 to h-12 (client feedback: wanted more visible/
 * prominent branding in the one place the full wordmark appears, since
 * the sidebar is icon-only).
 *
 * Client-confirmed alignment fix: the logo used to sit in a shrink-to-
 * content cell, so the command palette's left edge landed wherever the
 * logo's own rendered width happened to end — a few pixels short of
 * the Settings nav column's 192px width (§8.9) one row down, reading
 * as a small stray gap between the search field and the "My Profile"
 * panel beneath it. The logo now sits in a fixed 176px cell (+ the
 * header's own 16px left padding = 192px), so the palette's left edge
 * lines up exactly with the Settings nav column's right edge / main
 * content's left edge on every page, not just approximately.
 */
export function TopBar({
  fullName,
  access,
  accountId,
}: {
  fullName: string;
  /** Omitted on the CRO Leader's lightweight header (App Flow §4.10) —
   * a CRO Leader who hasn't entered an MSP account yet has no account
   * context for the palette's contacts search or "Go to" section
   * access to run against, so it's simply not rendered there. */
  access?: Record<NavSection, NavAccess>;
  accountId?: string;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center bg-white px-4 shadow-[0_1px_0_var(--color-neutral-200),0_6px_16px_-12px_rgba(10,25,46,0.15)]">
      <Link href="/dashboard" className="flex w-44 shrink-0 items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/growthos-logo.png" alt="GrowthOS" className="h-12 w-auto" />
      </Link>

      {access && accountId && (
        <div className="flex-1">
          <CommandPalette access={access} accountId={accountId} />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full ring-2 ring-transparent ring-offset-2 transition-shadow hover:ring-secondary-100 focus-visible:outline-none focus-visible:ring-secondary-500/40">
            <Avatar>
              <AvatarFallback>{initials(fullName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">My Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/email">Connected Email Accounts</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>Log Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
