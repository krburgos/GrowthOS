"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Design System §8.9 — Settings navigation panel. A second docked
 * column shown only within /settings/*, replacing the old horizontal
 * tab bar that lived inside each Settings page. Every item here is a
 * single, non-nested destination — none of GrowthOS's Settings screens
 * need a further sub-tab layer.
 */
const ITEMS = [
  { href: "/settings/company", label: "Company Profile" },
  { href: "/settings/users", label: "Users & Roles" },
  { href: "/settings/email", label: "Connected Email Accounts" },
  { href: "/settings/statuses", label: "Contact Statuses" },
  { href: "/settings/opportunity-stages", label: "Opportunity Stages" },
  { href: "/settings/profile", label: "My Profile" },
];

export function SettingsPanel() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white py-4">
      <h2 className="mb-2 px-4 text-h4 text-primary-900">Settings</h2>
      <nav className="flex flex-col gap-0.5 px-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-11 items-center rounded-md px-3 text-body transition-colors",
                active ? "bg-secondary-50 text-primary-700" : "text-neutral-700 hover:bg-neutral-50"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
