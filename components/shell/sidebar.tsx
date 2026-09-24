"use client";

import {
  BarChart3,
  Compass,
  Building2,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Mail,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavAccess, NavSection } from "@/lib/auth/nav-permissions";
import { cn } from "@/lib/utils";

export interface NavItem {
  section: NavSection | "dashboard" | "gosDashboard" | "foundation";
  /** Rendered beneath the item while the rail is expanded. */
  children?: { key: FoundationKey; label: string; href: string }[];
  label: string;
  href: string;
  /** Path prefix used to compute the active state, when it differs from
   * `href` itself (e.g. Settings links to one sub-page but should stay
   * highlighted across all of them). */
  matchPrefix?: string;
  icon: ComponentType<{ className?: string }>;
}

/** The three documents under Foundation, keyed so the shell can say which are done. */
export type FoundationKey = "companyProfile" | "questionnaire" | "visionBoard";

/** Exported so the command palette (§8.10) can reuse the exact same
 * destination list rather than maintaining a second, drift-prone copy. */
export const NAV_ITEMS: NavItem[] = [
  { section: "dashboard", label: "Homepage", href: "/dashboard", icon: LayoutDashboard },
  // Client-confirmed sequence "A" (2026-09-24): Foundation sits directly
  // above Command Center because it feeds it — the readiness strip blocks
  // that page until all three of these are complete. Read top to bottom the
  // rail tells the story: your day, what you set up, the plan being
  // executed, the data, the reporting, the plumbing.
  {
    section: "foundation",
    label: "Foundation",
    href: "/foundation",
    matchPrefix: "/foundation",
    icon: Compass,
    children: [
      { key: "companyProfile", label: "Company Profile", href: "/foundation/company-profile" },
      { key: "questionnaire", label: "Solution Questionnaire", href: "/foundation/solution-questionnaire" },
      { key: "visionBoard", label: "Vision Board", href: "/foundation/vision-board" },
    ],
  },
  { section: "gosDashboard", label: "Command Center", href: "/gos-dashboard", icon: LayoutGrid },
  { section: "contacts", label: "Contacts", href: "/contacts", icon: Users },
  { section: "companies", label: "Companies", href: "/companies", icon: Building2 },
  { section: "opportunities", label: "Opportunities", href: "/opportunities", icon: Target },
  { section: "lists", label: "Lists", href: "/lists", icon: ListChecks },
  { section: "campaigns", label: "Campaigns", href: "/campaigns", icon: Mail },
  { section: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
  {
    section: "settings",
    label: "Settings",
    href: "/settings",
    matchPrefix: "/settings",
    icon: Settings,
  },
];

const SIDEBAR_COLLAPSED_KEY = "growthos.sidebar.collapsed";

/**
 * Design System §8.9 — Sidebar Navigation. primary-900 background (now a
 * top-to-bottom gradient, primary-800→primary-950), 70% white icon
 * default, active pill (primary-700 bg + secondary-500 rail), disabled
 * items at 30% opacity.
 *
 * Sidebar redesign — Concept C, "Toggleable Rail" (approved mockup,
 * 2026-09-06): the icon-only-at-every-width version this replaced
 * relied on a hover tooltip as the *only* way to learn what an icon
 * meant — an Impeccable critique flagged that as both a Recognition-
 * vs-Recall regression and an accessibility gap (a tooltip isn't a
 * reliable accessible-name mechanism). This version opens **expanded**
 * (`--sidebar-width-expanded`, 240px — already spec'd in §9, just never
 * wired up) by default, with labels always in the DOM (so the link's
 * accessible name comes from real text, not a synthesized aria-label)
 * and a bottom toggle to collapse to the icon-only 64px rail for users
 * who want the table width back. The choice persists per browser via
 * localStorage — same pattern as the Contacts column picker — so
 * nobody re-collapses it every session. The tooltip is kept, but only
 * while collapsed, as a quick label check without a full expand.
 */
export function Sidebar({
  access,
  foundationDone,
}: {
  access: Record<NavSection, NavAccess>;
  /** Which of the three Foundation documents are complete. */
  foundationDone: Record<FoundationKey, boolean>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-gradient-to-b from-primary-800 to-primary-950 py-4 shadow-[1px_0_0_rgba(255,255,255,0.06)] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width-expanded)]"
      )}
    >
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const itemAccess: NavAccess =
            item.section === "dashboard" || item.section === "gosDashboard" || item.section === "foundation"
              ? "full"
              : access[item.section];
          const disabled = itemAccess === "disabled";
          const matchAgainst = item.matchPrefix ?? item.href;
          const active = pathname === matchAgainst || pathname.startsWith(`${matchAgainst}/`);
          const Icon = item.icon;
          const outstanding = item.children?.filter((c) => !foundationDone[c.key]).length ?? 0;

          const content = (
            <span className="relative flex h-10 items-center">
              {active && (
                <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-secondary-500" />
              )}
              <span
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-md px-2.5 transition-colors",
                  disabled
                    ? "cursor-not-allowed text-white/30"
                    : active
                      ? "bg-primary-700 text-white shadow-inner"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap text-body-sm font-medium",
                    collapsed
                      ? "pointer-events-none opacity-0 transition-opacity duration-75"
                      : "opacity-100 transition-opacity delay-75 duration-150"
                  )}
                >
                  {item.label}
                </span>
                {/* A count of what is still outstanding, on the one item
                    that can say. It survives collapsing, and disappears at
                    zero so a finished account sees a plain icon rather than
                    a permanent decoration. */}
                {outstanding > 0 && (
                  <span
                    className={cn(
                      "flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-warning-400 px-1 text-[10px] font-bold text-primary-950",
                      collapsed ? "absolute right-1 top-0.5" : "ml-auto"
                    )}
                    aria-label={`${outstanding} still to complete`}
                  >
                    {outstanding}
                  </span>
                )}
              </span>
            </span>
          );

          const link = disabled ? (
            <span aria-disabled="true">{content}</span>
          ) : (
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              {content}
            </Link>
          );

          if (!collapsed) {
            return (
              <div key={item.section}>
                {link}
                {item.children && (
                  <div className="ml-[25px] mt-0.5 mb-1 flex flex-col gap-px border-l border-white/15 pl-3">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href;
                      const done = foundationDone[child.key];
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-caption transition-colors",
                            childActive
                              ? "bg-white/10 font-semibold text-white"
                              : "text-white/60 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <span className="min-w-0 truncate">{child.label}</span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "ml-auto size-1.5 shrink-0 rounded-full",
                              done ? "bg-success-400" : "bg-warning-400"
                            )}
                          />
                          <span className="sr-only">{done ? "complete" : "still to complete"}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Tooltip key={item.section}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-2">
        <div className="mb-2 h-px bg-white/10" />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-[background-color,transform] duration-200 ease-in-out hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft className={cn("size-3.5 transition-transform duration-200 ease-in-out", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
