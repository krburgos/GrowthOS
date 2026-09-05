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
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-4">
      <Link href="/dashboard" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/growthos-logo.png" alt="GrowthOS" className="h-10 w-auto" />
      </Link>

      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input placeholder="Search contacts…" className="pl-9" disabled />
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
          <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2">
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
