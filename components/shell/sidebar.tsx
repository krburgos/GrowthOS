"use client";

import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  Mail,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavAccess, NavSection } from "@/lib/auth/nav-permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  section: NavSection | "dashboard";
  label: string;
  href: string;
  /** Path prefix used to compute the active state, when it differs from
   * `href` itself (e.g. Settings links to one sub-page but should stay
   * highlighted across all of them). */
  matchPrefix?: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { section: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { section: "contacts", label: "Contacts", href: "/contacts", icon: Users },
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

/**
 * Design System §8.9 — Sidebar Navigation. Client-confirmed redesign:
 * icon-only at every width now (not just below lg), modeled on
 * reference screenshots of another CRM's icon-rail nav — colors stay
 * GrowthOS's own. primary-900 background, 70% white icon default,
 * active pill (100% opacity + primary-800 bg, radius-md, 8px inset),
 * disabled items at 30% opacity. The label now only ever appears in the
 * hover/focus tooltip; an `aria-label` on the link/disabled span itself
 * (added after an Impeccable critique flagged the tooltip alone as an
 * unreliable accessible-name mechanism, 2026-09-06) carries the same
 * text for assistive tech, independent of the tooltip's own reveal.
 *
 * Client-confirmed modernization pass (approved mockup): a subtle
 * top-to-bottom gradient instead of a flat fill, and the active item
 * gets a secondary-500 rail — the same "this is selected" language now
 * used on table rows and the Settings nav — alongside its existing
 * filled pill.
 */
export function Sidebar({ access }: { access: Record<NavSection, NavAccess> }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[var(--sidebar-width-collapsed)] shrink-0 flex-col bg-gradient-to-b from-primary-800 to-primary-950 py-4 shadow-[1px_0_0_rgba(255,255,255,0.06)]">
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const itemAccess: NavAccess = item.section === "dashboard" ? "full" : access[item.section];
          const disabled = itemAccess === "disabled";
          const matchAgainst = item.matchPrefix ?? item.href;
          const active = pathname === matchAgainst || pathname.startsWith(`${matchAgainst}/`);
          const Icon = item.icon;

          const content = (
            <span className="relative flex h-10 w-10 items-center justify-center">
              {active && (
                <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-secondary-500" />
              )}
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                  disabled
                    ? "cursor-not-allowed text-white/30"
                    : active
                      ? "bg-primary-700 text-white shadow-inner"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="size-5 shrink-0" />
              </span>
            </span>
          );

          return (
            <Tooltip key={item.section}>
              <TooltipTrigger asChild>
                {disabled ? (
                  <span aria-disabled="true" aria-label={item.label}>
                    {content}
                  </span>
                ) : (
                  <Link href={item.href} aria-current={active ? "page" : undefined} aria-label={item.label}>
                    {content}
                  </Link>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
