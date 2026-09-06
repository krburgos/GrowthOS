"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Design System §8.10 — Top Bar. White bg, 1px neutral-200 bottom
 * border, 56px height, logo left, search center-left, bell + user menu
 * right. Search is Contacts-only (App Flow §2.3) — visually in place now,
 * wired once Contacts (Milestone 6) exists to search against.
 *
 * Client-confirmed modernization pass (approved mockup): a filled
 * search field instead of a bare bordered box, a subtle shadow instead
 * of a flat border, and a teal avatar ring to match the rest of the
 * app's "teal = focus/active" language.
 *
 * Impeccable critique finding (2026-09-06, P2): the bell briefly grew a
 * hardcoded "unread" dot with no real state behind it — a persistently
 * lying indicator that would train users to ignore it. Removed until an
 * actual unread-notifications source exists to drive it honestly.
 */
export function TopBar({ fullName }: { fullName: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-4 bg-white px-4 shadow-[0_1px_0_var(--color-neutral-200),0_6px_16px_-12px_rgba(10,25,46,0.15)]">
      <Link href="/dashboard" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/growthos-logo.png" alt="GrowthOS" className="h-10 w-auto" />
      </Link>

      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        {/* Disabled until Contacts search is wired up — the softer fill
            is cosmetic only here since focus/hover can't trigger on a
            disabled field, kept simple rather than styling unreachable states. */}
        <Input placeholder="Search contacts…" disabled className="border-transparent bg-neutral-50 pl-9" />
      </div>

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
