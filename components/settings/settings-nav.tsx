"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * App Flow §4.9 lists Users & Roles (I1), Connected Email Accounts (I2),
 * Custom Statuses (I3), and My Profile (I4) as separate screens but
 * doesn't specify how a user moves between them — this sub-nav is a
 * reasonable gap-fill, not a spec'd component.
 */
const ITEMS = [
  { href: "/settings/users", label: "Users & Roles" },
  { href: "/settings/email", label: "Connected Email Accounts" },
  { href: "/settings/statuses", label: "Custom Statuses" },
  { href: "/settings/profile", label: "My Profile" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex items-center gap-1 border-b border-neutral-200">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex h-10 items-center px-4 text-body transition-colors",
              active
                ? "text-primary-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary-700"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
