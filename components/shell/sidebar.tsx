"use client";

import {
  BarChart3,
  Building2,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Mail,
  MapPin,
  Settings,
  Target,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

import { useMobileNav } from "@/components/shell/mobile-nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavAccess, NavSection } from "@/lib/auth/nav-permissions";
import { cn } from "@/lib/utils";

export interface NavItem {
  section: NavSection | "dashboard" | "gosDashboard" | "myVisits";
  label: string;
  href: string;
  /** Path prefix used to compute the active state, when it differs from
   * `href` itself (e.g. Settings links to one sub-page but should stay
   * highlighted across all of them). */
  matchPrefix?: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * Shown only below `lg`. My Visits is the Advocate's field screen
   * (client-confirmed, 2026-10-05) — on a desktop the drop-by table on the
   * AdvocateDash workstream page says everything it does and more, so
   * putting it in the desktop rail would add a ninth destination that
   * duplicates one already there.
   */
  mobileOnly?: boolean;
}

/** Exported so the command palette (§8.10) can reuse the exact same
 * destination list rather than maintaining a second, drift-prone copy. */
export const NAV_ITEMS: NavItem[] = [
  { section: "dashboard", label: "Homepage", href: "/dashboard", icon: LayoutDashboard },
  { section: "gosDashboard", label: "Command Center", href: "/gos-dashboard", icon: LayoutGrid },
  {
    section: "myVisits",
    label: "My Visits",
    href: "/my-visits",
    icon: MapPin,
    mobileOnly: true,
  },
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
 * (`--sidebar-width-expanded`, 240px) by default, with labels always in
 * the DOM (so the link's accessible name comes from real text, not a
 * synthesized aria-label) and a bottom toggle to collapse to the
 * icon-only 64px rail for users who want the table width back. The
 * choice persists per browser via localStorage — same pattern as the
 * Contacts column picker — so nobody re-collapses it every session. The
 * tooltip is kept, but only while collapsed, as a quick label check
 * without a full expand.
 *
 * **Phone and tablet (client-confirmed, 2026-10-05).** Below `lg` this
 * is not a column at all — it is an off-canvas drawer behind the top
 * bar's hamburger, and the content column gets the full viewport width.
 * Before this, the 240px rail took 62% of a 390px screen and nothing
 * collapsed it automatically; the Design System claimed a width-based
 * collapse that had never shipped. The expand/collapse toggle is
 * desktop-only, because a drawer is either open or shut — a 64px rail
 * inside a drawer would be a rail nobody asked for.
 */
export function Sidebar({ access }: { access: Record<NavSection, NavAccess> }) {
  const [collapsed, setCollapsed] = useState(false);
  const { open, close } = useMobileNav();

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

  const surface =
    "flex flex-col bg-gradient-to-b from-primary-800 to-primary-950 py-4 shadow-[1px_0_0_rgba(255,255,255,0.06)]";

  return (
    <>
      {/* The desktop rail. `hidden lg:flex` rather than a width of zero, so
          a phone never has it in the layout at all. */}
      <aside
        className={cn(
          surface,
          "hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:flex",
          collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width-expanded)]"
        )}
      >
        <NavList access={access} collapsed={collapsed} withTooltips />

        <div className="mt-auto px-3 pt-2">
          <div className="mb-2 h-px bg-white/10" />
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-[background-color,transform] duration-200 ease-in-out hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft
              className={cn("size-3.5 transition-transform duration-200 ease-in-out", collapsed && "rotate-180")}
            />
          </button>
        </div>
      </aside>

      {/* The drawer, below lg. Kept mounted so it can animate, and
          `invisible` when shut — visibility:hidden takes its links out of
          the tab order, which `opacity-0` alone would not. */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "visible" : "invisible pointer-events-none"
        )}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Close navigation"
          onClick={close}
          className={cn(
            "absolute inset-0 bg-primary-950/60 transition-opacity duration-200 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          aria-label="Navigation"
          className={cn(
            surface,
            "absolute inset-y-0 left-0 w-[17rem] max-w-[82vw] overflow-y-auto transition-transform duration-200 ease-out motion-reduce:transition-none",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-body-sm font-bold text-white">GrowthOS</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="flex size-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
          {/* Never collapsed and never tooltip-only: a drawer has the room
              for labels, and touch cannot hover. */}
          <NavList access={access} collapsed={false} onNavigate={close} includeMobileOnly />
        </aside>
      </div>
    </>
  );
}

/**
 * The link list, shared by the rail and the drawer so the two can never
 * drift apart on destinations, active state or permissions.
 */
function NavList({
  access,
  collapsed,
  withTooltips = false,
  includeMobileOnly = false,
  onNavigate,
}: {
  access: Record<NavSection, NavAccess>;
  collapsed: boolean;
  withTooltips?: boolean;
  includeMobileOnly?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.filter((item) => includeMobileOnly || !item.mobileOnly).map((item) => {
        const itemAccess: NavAccess =
          item.section === "dashboard" || item.section === "gosDashboard" || item.section === "myVisits"
            ? "full"
            : access[item.section];
        const disabled = itemAccess === "disabled";
        const matchAgainst = item.matchPrefix ?? item.href;
        const active = pathname === matchAgainst || pathname.startsWith(`${matchAgainst}/`);
        const Icon = item.icon;

        const content = (
          <span className="relative flex h-11 items-center lg:h-10">
            {active && (
              <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-secondary-500" />
            )}
            <span
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-md px-2.5 transition-colors lg:h-10",
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
            </span>
          </span>
        );

        const link = disabled ? (
          <span aria-disabled="true">{content}</span>
        ) : (
          <Link href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            {content}
          </Link>
        );

        if (!withTooltips || !collapsed) return <div key={item.section}>{link}</div>;

        return (
          <Tooltip key={item.section}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
