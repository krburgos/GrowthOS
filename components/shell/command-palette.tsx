"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Plus, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";

import { NAV_ITEMS } from "@/components/shell/sidebar";
import type { NavAccess, NavSection } from "@/lib/auth/nav-permissions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ContactHit {
  id: string;
  full_name: string;
  companies: { name: string } | { name: string }[] | null;
}

interface PaletteItem {
  key: string;
  label: string;
  sublabel?: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
}

const ACTIONS: { key: string; label: string; href: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "action-add-contact", label: "Add Contact", href: "/contacts/new", icon: Plus },
  { key: "action-create-list", label: "Create List", href: "/lists/new", icon: Plus },
];

/**
 * Design System §8.10 — Top Bar. Client-confirmed replacement for the
 * disabled Contacts-search field (approved mockup, "Concept B — Command
 * Palette"): rather than a search box wired to a feature that doesn't
 * exist yet, this reframes "search" as navigation — jump to a recent
 * contact, run a quick action, or go to a section — all buildable
 * without any contacts-search backend. "Create Opportunity" is
 * deliberately not in Actions: /opportunities/new requires a
 * contact_id today (an opportunity can only be created from a
 * contact's own page), so a standalone shortcut would just 404.
 *
 * Opens on click, or globally via Cmd/Ctrl+K from anywhere in the app
 * (the listener lives here since this component is mounted once, in
 * the Top Bar, for the lifetime of the authenticated shell).
 *
 * Fixes (2026-10-14, the client found it clunky):
 * - Hover set the highlight from a counter that had already run to the
 *   last row during render, so pointing at any result highlighted the
 *   bottom one, and Enter opened that. Each row now knows its own index.
 * - Results were cleared and refilled on every keystroke, so the panel
 *   shrank, grew and reshuffled. The last results now stay until the new
 *   ones arrive, behind a small spinner in the field, over a list with a
 *   steady minimum height.
 * - The highlight is kept in range when results change, and scrolls into
 *   view as the arrow keys move it.
 * - The shortcut reads Ctrl K off a Mac, and the panel keeps a margin on
 *   phones. Search matches email as well as name.
 */
export function CommandPalette({
  access,
  accountId,
}: {
  access: Record<NavSection, NavAccess>;
  accountId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Decided after mount, so the server render and the first client render match.
  const [isMac, setIsMac] = useState(true);
  useEffect(() => setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setContacts([]);
      setActiveIndex(0);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    const timeout = setTimeout(async () => {
      const request = supabase
        .from("contacts")
        .select("id, full_name, companies(name)")
        .eq("account_id", accountId)
        .is("archived_at", null);

      // Commas and brackets would break PostgREST's or() syntax.
      const term = query.trim().replace(/[,()%]/g, " ").trim();
      const { data } = term
        ? await request.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).order("full_name").limit(8)
        : await request.order("updated_at", { ascending: false }).limit(5);

      setContacts((data ?? []) as unknown as ContactHit[]);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [open, query, accountId]);

  const navItems: PaletteItem[] = useMemo(
    () =>
      // `mobileOnly` items are left out here for the same reason they are
      // left out of the desktop rail: My Visits is a narrow field screen
      // and the AdvocateDash workstream page says more on a desktop.
      NAV_ITEMS.filter((item) => !item.mobileOnly)
        .filter((item) =>
          item.section === "dashboard" || item.section === "growthMission" || item.section === "myVisits"
            ? true
            : access[item.section] !== "disabled"
        )
        .filter((item) => !query.trim() || item.label.toLowerCase().includes(query.trim().toLowerCase()))
        .map((item) => ({ key: `nav-${item.section}`, label: item.label, icon: item.icon, href: item.href })),
    [access, query]
  );

  const actionItems: PaletteItem[] = useMemo(
    () =>
      ACTIONS.filter((a) => !query.trim() || a.label.toLowerCase().includes(query.trim().toLowerCase())).map(
        (a) => ({ key: a.key, label: a.label, icon: a.icon, href: a.href })
      ),
    [query]
  );

  const contactItems: PaletteItem[] = useMemo(
    () =>
      contacts.map((c) => {
        const company = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        return {
          key: `contact-${c.id}`,
          label: c.full_name,
          sublabel: company?.name,
          icon: User,
          href: `/contacts/${c.id}`,
        };
      }),
    [contacts]
  );

  const groups = [
    { label: query.trim() ? "Contacts" : "Recent Contacts", items: contactItems },
    { label: "Actions", items: actionItems },
    { label: "Go to", items: navItems },
  ].filter((g) => g.items.length > 0);

  const flatItems = groups.flatMap((g) => g.items);
  const indexOf = new Map(flatItems.map((item, i) => [item.key, i]));

  // Keep the highlight on a real row when the results change.
  useEffect(() => {
    if (activeIndex > flatItems.length - 1) setActiveIndex(Math.max(0, flatItems.length - 1));
  }, [flatItems.length, activeIndex]);

  // Follow the highlight when the arrow keys move it past the visible rows.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = (item: PaletteItem) => {
    setOpen(false);
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) go(item);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {/* Icon-only below lg: a 390px top bar has no room for a search
            field beside the hamburger, logo, bell and avatar — but the
            trigger is a real button, so dropping it entirely would take
            search away from touch users who have no Cmd+K. */}
        <button
          type="button"
          aria-label="Search or jump to"
          className="flex size-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 text-body-sm text-neutral-400 transition-colors hover:border-secondary-300 lg:h-9 lg:w-full lg:max-w-sm lg:justify-start lg:px-3"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden flex-1 text-left lg:block">Search or jump to…</span>
          <span className="hidden items-center gap-0.5 lg:flex">
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-caption font-semibold text-neutral-500">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-caption font-semibold text-neutral-500">
              K
            </kbd>
          </span>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary-950/40" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg sm:top-[15%]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Search or jump to</DialogPrimitive.Title>
          <div className="flex h-14 items-center gap-2.5 border-b border-neutral-200 px-4">
            <Search className="size-[18px] shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search contacts, or jump to a page…"
              aria-label="Search contacts, or jump to a page"
              className="min-w-0 flex-1 bg-transparent text-body text-neutral-800 outline-none placeholder:text-neutral-400"
            />
            {loading && <Loader2 aria-label="Searching" className="size-4 shrink-0 animate-spin text-neutral-400 motion-reduce:animate-none" />}
          </div>

          <div ref={listRef} className="max-h-[min(22rem,60vh)] min-h-[12rem] overflow-y-auto p-2">
            {!loading && flatItems.length === 0 && (
              <p className="px-2.5 py-6 text-center text-body-sm text-neutral-400">
                No contacts or pages match &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
            {groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const index = indexOf.get(item.key) ?? 0;
                  const isActive = index === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-index={index}
                      onClick={() => go(item)}
                      onMouseMove={() => index !== activeIndex && setActiveIndex(index)}
                      className={cn(
                        "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body-sm",
                        isActive ? "bg-secondary-50 text-secondary-800" : "text-neutral-700"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", isActive ? "text-secondary-700" : "text-neutral-400")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.sublabel && <span className="shrink-0 text-caption text-neutral-400">{item.sublabel}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="hidden items-center gap-4 border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-caption text-neutral-500 sm:flex">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
            </span>
            <span>
              <Kbd>Enter</Kbd> to open
            </span>
            <span>
              <Kbd>Esc</Kbd> to close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-px font-sans text-caption font-semibold text-neutral-600">
      {children}
    </kbd>
  );
}
