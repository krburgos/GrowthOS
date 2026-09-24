"use client";

import { Bell, ClipboardList, Compass } from "lucide-react";
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
import { TOTAL_QUESTION_COUNT } from "@/lib/questionnaire/questions";
import { TOTAL_FIELD_COUNT } from "@/lib/vision-board/sections";
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
 *
 * Client-confirmed (2026-09-15) — the bell is now real, not decorative:
 * its one possible item is the GrowthOS Solution Questionnaire reminder,
 * and the dot only renders while `questionnaireComplete` is false. Still
 * honest by the same rule that removed the old hardcoded dot — no item,
 * no dot, ever.
 *
 * Client-confirmed (2026-09-16) — a second, independent item for the
 * GrowthOS Vision Board, same on/off rule as the Questionnaire's. Both
 * can be true at once (the dropdown lists whichever are incomplete;
 * the dot shows if either is).
 */
export function TopBar({
  fullName,
  access,
  accountId,
  questionnaireAnsweredCount,
  questionnaireComplete,
  visionBoardAnsweredCount,
  visionBoardComplete,
}: {
  fullName: string;
  /** Omitted on the CRO Leader's lightweight header (App Flow §4.10) —
   * a CRO Leader who hasn't entered an MSP account yet has no account
   * context for the palette's contacts search or "Go to" section
   * access to run against, so it's simply not rendered there. */
  access?: Record<NavSection, NavAccess>;
  accountId?: string;
  questionnaireAnsweredCount?: number;
  questionnaireComplete?: boolean;
  visionBoardAnsweredCount?: number;
  visionBoardComplete?: boolean;
}) {
  const router = useRouter();
  const showQuestionnaireItem = !questionnaireComplete && questionnaireAnsweredCount !== undefined;
  const showVisionBoardItem = !visionBoardComplete && visionBoardAnsweredCount !== undefined;
  const hasNotification = showQuestionnaireItem || showVisionBoardItem;

  const handleLogout = async () => {
    // Same "viewing as" cookie cleanup as login (components/auth/login-form.tsx)
    // -- defensive here too, so a shared browser never hands the next
    // person who logs in someone else's leftover viewing-as state.
    await fetch("/api/cro/exit", { method: "POST" });
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {hasNotification && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full border border-white bg-error-600" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {hasNotification ? (
              <>
                {showQuestionnaireItem && (
                  <DropdownMenuItem asChild className="flex items-start gap-3 py-2.5">
                    <Link href="/foundation/solution-questionnaire">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                        <ClipboardList className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body-sm font-semibold text-neutral-800">
                          Complete your GrowthOS Solution Questionnaire
                        </span>
                        <span className="block text-caption text-neutral-500">
                          {questionnaireAnsweredCount} of {TOTAL_QUESTION_COUNT} answered — tap to continue
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {showVisionBoardItem && (
                  <DropdownMenuItem asChild className="flex items-start gap-3 py-2.5">
                    <Link href="/foundation/vision-board">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                        <Compass className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm font-semibold text-neutral-800">
                          Complete your GrowthOS Vision Board
                        </span>
                        <span className="block text-caption text-neutral-500">
                          {visionBoardAnsweredCount} of {TOTAL_FIELD_COUNT} answered — tap to continue
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <p className="px-2 py-6 text-center text-body-sm text-neutral-400">You&apos;re all caught up.</p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
              <Link href="/settings/users">Account Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>Log Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
