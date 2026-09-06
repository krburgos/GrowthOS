"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Plus, Search, User } from "lucide-react";
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

      const { data } = query.trim()
        ? await request.ilike("full_name", `%${query.trim()}%`).order("full_name").limit(8)
        : await request.order("updated_at", { ascending: false }).limit(5);

      setContacts((data ?? []) as unknown as ContactHit[]);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [open, query, accountId]);

  const navItems: PaletteItem[] = useMemo(
    () =>
      NAV_ITEMS.filter((item) => (item.section === "dashboard" ? true : access[item.section] !== "disabled"))
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

  let runningIndex = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body-sm text-neutral-400 transition-colors hover:border-secondary-300"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-caption font-semibold text-neutral-500">
              ⌘
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
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg bg-white shadow-lg"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Search or jump to</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4 py-3">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or jump to…"
              className="flex-1 text-body text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {loading && query.trim() && (
              <p className="px-2 py-3 text-caption text-neutral-400">Searching…</p>
            )}
            {!loading && flatItems.length === 0 && (
              <p className="px-2 py-3 text-caption text-neutral-400">No matches.</p>
            )}
            {groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => go(item)}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body-sm",
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
