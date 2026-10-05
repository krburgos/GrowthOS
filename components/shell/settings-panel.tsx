"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AccountSub = "company" | "growth_questionnaire" | "vision_board" | "users" | "customizations";

const ACCOUNT_SUB_BY_PATH: Record<string, AccountSub> = {
  "/settings/company": "company",
  "/settings/growth-questionnaire": "growth_questionnaire",
  "/settings/vision-board": "vision_board",
  "/settings/users": "users",
  "/settings/statuses": "customizations",
  "/settings/opportunity-stages": "customizations",
};

interface Row {
  label: string;
  href?: string;
}

const MY_PROFILE_ROWS: Row[] = [
  { label: "Contact Information", href: "/settings/profile" },
  { label: "Email Signature" },
  { label: "Password", href: "/settings/profile/password" },
  { label: "Two Factor Auth" },
  { label: "Phone Numbers" },
  { label: "Notifications" },
  { label: "Email Integration", href: "/settings/email" },
];

const ACCOUNT_SETTINGS_ROWS: (Row & { sub?: AccountSub })[] = [
  { label: "Company Profile", href: "/settings/company", sub: "company" },
  { label: "Solution Questionnaire", href: "/settings/growth-questionnaire", sub: "growth_questionnaire" },
  { label: "Vision Board", href: "/settings/vision-board", sub: "vision_board" },
  { label: "Billing & Payments" },
  { label: "Email Auth" },
  { label: "Users", href: "/settings/users", sub: "users" },
  { label: "Integrations" },
  { label: "Customizations", href: "/settings/statuses", sub: "customizations" },
];

const ACCOUNT_SUB_ROWS: Partial<Record<AccountSub, Row[]>> = {
  users: [{ label: "Users & Roles", href: "/settings/users" }],
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
  company: "Company Profile",
  growth_questionnaire: "Solution Questionnaire",
  vision_board: "Vision Board",
  users: "Users",
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
    /* Below `lg` the column becomes a full-width band with its links in a
       horizontal scrolling strip (client-confirmed fix, 2026-10-05).
       Settings can render *two* of these at once — Account Settings plus a
       sub-section — which at 192px each took 384px of a 390px screen and
       left no room for the page they navigate to. */
    <div className="flex w-full shrink-0 flex-col border-b border-neutral-200 bg-white py-3 lg:w-48 lg:border-b-0 lg:border-r lg:py-4">
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
      {/* A horizontal strip below lg, the column it has always been from lg
          up. The active rail moves from the left edge to underneath,
          because a 3px bar to the left of a pill in a horizontal row reads
          as a divider between two links rather than a marker on one. */}
      <nav className="flex gap-0.5 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col [&::-webkit-scrollbar]:hidden">
        {rows.map((row) =>
          row.href ? (
            <Link
              key={row.label}
              href={row.href}
              title={row.label}
              className={cn(
                "relative flex h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-body transition-colors lg:shrink lg:truncate",
                activeHref === row.href
                  ? "bg-secondary-50 font-medium text-primary-700 before:absolute before:inset-x-3 before:bottom-0 before:h-[3px] before:rounded-full before:bg-secondary-500 lg:before:inset-x-auto lg:before:-left-2 lg:before:top-1/2 lg:before:h-5 lg:before:w-[3px] lg:before:-translate-y-1/2"
                  : "text-neutral-700 hover:bg-neutral-50"
              )}
            >
              {row.label}
            </Link>
          ) : (
            <span
              key={row.label}
              aria-disabled="true"
              title={row.label}
              className="flex h-11 shrink-0 cursor-not-allowed items-center whitespace-nowrap rounded-md px-3 text-body text-neutral-300 lg:shrink lg:truncate"
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

  if (pathname === "/settings/profile" || pathname === "/settings/profile/password" || pathname === "/settings/email") {
    return <NavColumn title="My Profile" rows={MY_PROFILE_ROWS} activeHref={pathname} backHref="/settings" />;
  }

  const accountSub = ACCOUNT_SUB_BY_PATH[pathname];
  if (accountSub) {
    const subRows = ACCOUNT_SUB_ROWS[accountSub];
    return (
      <>
        <NavColumn
          title="Account Settings"
          rows={ACCOUNT_SETTINGS_ROWS}
          activeHref={ACCOUNT_SETTINGS_ROWS.find((r) => r.sub === accountSub)?.href}
          backHref="/settings"
        />
        {subRows && <NavColumn title={ACCOUNT_SUB_TITLE[accountSub]} rows={subRows} activeHref={pathname} />}
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
