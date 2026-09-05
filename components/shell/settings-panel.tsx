"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AccountSub = "company" | "users" | "email" | "customizations";

const ACCOUNT_SUB_BY_PATH: Record<string, AccountSub> = {
  "/settings/company": "company",
  "/settings/users": "users",
  "/settings/email": "email",
  "/settings/statuses": "customizations",
  "/settings/opportunity-stages": "customizations",
};

interface Row {
  label: string;
  href?: string;
}

const MY_PROFILE_ROWS: Row[] = [
  { label: "Contact Information", href: "/settings/profile#contact-information" },
  { label: "Email Signature" },
  { label: "WOLI AI Helper" },
  { label: "Password", href: "/settings/profile#password" },
  { label: "Two Factor Auth" },
  { label: "Phone Numbers" },
  { label: "Notifications" },
  { label: "Integrations" },
];

const ACCOUNT_SETTINGS_ROWS: (Row & { sub?: AccountSub })[] = [
  { label: "Company", href: "/settings/company", sub: "company" },
  { label: "Billing & Payments" },
  { label: "Email Auth", href: "/settings/email", sub: "email" },
  { label: "Users", href: "/settings/users", sub: "users" },
  { label: "Integrations" },
  { label: "Customizations", href: "/settings/statuses", sub: "customizations" },
];

const ACCOUNT_SUB_ROWS: Record<AccountSub, Row[]> = {
  company: [
    { label: "Company Profile", href: "/settings/company" },
    { label: "Company Details" },
    { label: "Branding" },
    { label: "Quotas" },
    { label: "Individual Quotas" },
    { label: "Opportunities" },
    { label: "Extreme Actions" },
    { label: "Preferred Currency" },
    { label: "WOLI AI Helper" },
    { label: "Account Privacy" },
  ],
  users: [{ label: "Users & Roles", href: "/settings/users" }],
  email: [{ label: "Connected Email Accounts", href: "/settings/email" }],
  customizations: [
    { label: "Signature" },
    { label: "Branding" },
    { label: "Solutions" },
    { label: "Company Types" },
    { label: "Contact Statuses", href: "/settings/statuses" },
    { label: "Opportunity Types" },
    { label: "Opportunity Stages", href: "/settings/opportunity-stages" },
    { label: "Verticals" },
    { label: "Categories" },
    { label: "Custom Contact Fields" },
    { label: "Custom Company Fields" },
    { label: "Custom Opportunity Fields" },
    { label: "Custom Insert Tags" },
    { label: "Custom Activity Types" },
  ],
};

const ACCOUNT_SUB_TITLE: Record<AccountSub, string> = {
  company: "Company",
  users: "Users",
  email: "Email Auth",
  customizations: "Customizations",
};

function NavColumn({
  title,
  rows,
  activeHref,
  backHref,
}: {
  title: string;
  rows: Row[];
  activeHref?: string;
  backHref?: string;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white py-4">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 flex items-center gap-1 px-4 text-body-sm text-primary-700 hover:underline"
        >
          <ChevronLeft className="size-4" />
          Go Back
        </Link>
      ) : null}
      <h2 className="mb-2 px-4 text-h4 text-primary-900">{title}</h2>
      <nav className="flex flex-col gap-0.5 px-2">
        {rows.map((row) =>
          row.href ? (
            <Link
              key={row.label}
              href={row.href}
              className={cn(
                "flex h-11 items-center rounded-md px-3 text-body transition-colors",
                activeHref === row.href
                  ? "bg-secondary-50 text-primary-700"
                  : "text-neutral-700 hover:bg-neutral-50"
              )}
            >
              {row.label}
            </Link>
          ) : (
            <span
              key={row.label}
              aria-disabled="true"
              className="flex h-11 cursor-not-allowed items-center rounded-md px-3 text-body text-neutral-300"
            >
              {row.label}
            </span>
          )
        )}
      </nav>
    </div>
  );
}

/**
 * Design System §8.9 — Settings navigation panels. A three-level
 * drill-down (client-confirmed, modeled on reference screenshots),
 * replacing the flatter single-list version first tried:
 * Level A (My Profile / Account Settings) → Level B (either branch's
 * own item list) → Level C (Account Settings only, driven by whichever
 * Level B row is active). Items with no corresponding GrowthOS page
 * render disabled rather than being omitted, matching the App Flow
 * §2.4 disabled-nav philosophy used everywhere else.
 */
export function SettingsPanel() {
  const pathname = usePathname();

  if (pathname === "/settings/profile") {
    return (
      <NavColumn
        title="My Profile"
        rows={MY_PROFILE_ROWS}
        activeHref="/settings/profile#contact-information"
        backHref="/settings"
      />
    );
  }

  const accountSub = ACCOUNT_SUB_BY_PATH[pathname];
  if (accountSub) {
    return (
      <>
        <NavColumn
          title="Account Settings"
          rows={ACCOUNT_SETTINGS_ROWS}
          activeHref={ACCOUNT_SETTINGS_ROWS.find((r) => r.sub === accountSub)?.href}
          backHref="/settings"
        />
        <NavColumn title={ACCOUNT_SUB_TITLE[accountSub]} rows={ACCOUNT_SUB_ROWS[accountSub]} activeHref={pathname} />
      </>
    );
  }

  return (
    <NavColumn
      title="Settings"
      rows={[
        { label: "My Profile", href: "/settings/profile" },
        { label: "Account Settings", href: "/settings/company" },
      ]}
    />
  );
}
