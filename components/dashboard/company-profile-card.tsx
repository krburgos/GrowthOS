import { Globe, Link as LinkIcon, MapPin, Pencil, Phone, Plus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  displayUrl,
  externalHref,
  formatAddress,
  initials,
  type CompanyProfile,
} from "@/lib/accounts/company-profile";

const CEO_TITLE = "Chief Executive Officer";

function ContactItem({ icon: Icon, hero, children }: { icon: typeof MapPin; hero: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn("size-[15px] shrink-0", hero ? "text-white/55" : "text-neutral-400")} />
      {children}
    </span>
  );
}

/**
 * Client-confirmed addition (2026-09-17) — the Company Profile leads the
 * Dashboard: logo, name, address, phone, website and LinkedIn, then the CEO
 * and the combined Sales & Marketing team. Read-only here by design; "Edit
 * profile" and the "+" both go to Settings › Company, which stays the one
 * place the profile is edited (the "+" lands on the team field directly).
 *
 * Client-confirmed color direction (2026-09-17, "Concept B"): the "hero"
 * variant drops the card's own white surface and renders inside the
 * Dashboard's navy-to-teal HeroBand, so the profile reads as the page header.
 */
export function CompanyProfileCard({
  account,
  canEdit,
  variant = "card",
}: {
  account: CompanyProfile;
  canEdit: boolean;
  variant?: "card" | "hero";
}) {
  const hero = variant === "hero";
  const address = formatAddress(account);
  const team = account.sales_marketing_names.filter((n) => n.trim());

  return (
    <section
      className={cn("overflow-hidden", hero ? "" : "rounded-lg border border-neutral-200 bg-white")}
      aria-label="Company profile"
    >
      <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-3.5", hero ? "pb-4" : "px-5 py-4")}>
        {account.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.logo_url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-lg text-h3 font-bold text-white",
              hero ? "bg-white/15" : "bg-gradient-to-br from-primary-800 to-secondary-700"
            )}
          >
            {initials(account.name)}
          </span>
        )}

        <div className="min-w-[240px] flex-1">
          <p className={cn("text-caption font-semibold", hero ? "text-white/55" : "text-neutral-400")}>Company profile</p>
          <h2 className={cn("mb-1 text-h3 font-semibold leading-tight", hero ? "text-white" : "text-primary-900")}>
            {account.name}
          </h2>
          <div className={cn("flex flex-wrap gap-x-[18px] gap-y-1.5 text-body-sm", hero ? "text-white/75" : "text-neutral-600")}>
            {address && <ContactItem icon={MapPin} hero={hero}>{address}</ContactItem>}
            {account.phone && <ContactItem icon={Phone} hero={hero}>{account.phone}</ContactItem>}
            {account.website && (
              <ContactItem icon={Globe} hero={hero}>
                <a
                  href={externalHref(account.website)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("font-medium hover:underline", hero ? "text-secondary-300" : "text-secondary-700")}
                >
                  {displayUrl(account.website)}
                </a>
              </ContactItem>
            )}
            {account.linkedin_url && (
              <ContactItem icon={LinkIcon} hero={hero}>
                <a
                  href={externalHref(account.linkedin_url)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("font-medium hover:underline", hero ? "text-secondary-300" : "text-secondary-700")}
                >
                  LinkedIn
                </a>
              </ContactItem>
            )}
            {!address && !account.phone && !account.website && !account.linkedin_url && (
              <span className={hero ? "text-white/55" : "text-neutral-400"}>No contact details yet</span>
            )}
          </div>
        </div>

        {canEdit && (
          <Link
            href="/settings/company"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-body-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
              hero ? "bg-white/10 text-white hover:bg-white/15" : "text-secondary-700 hover:bg-secondary-50"
            )}
          >
            <Pencil className="size-4" />
            Edit profile
          </Link>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 border-t md:grid-cols-[minmax(220px,0.9fr)_minmax(0,2.1fr)]",
          hero ? "border-white/15" : "border-neutral-100"
        )}
      >
        <div className={cn("pt-3.5", hero ? "pb-1 pr-5" : "px-5 pb-4")}>
          <p className={cn("mb-2.5 text-caption font-semibold uppercase tracking-wide", hero ? "text-white/55" : "text-neutral-400")}>
            CEO
          </p>
          {account.ceo_name ? (
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-[34px] shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                  hero ? "bg-white/15 text-white" : "bg-primary-100 text-primary-700"
                )}
              >
                {initials(account.ceo_name)}
              </span>
              <div className="min-w-0">
                <p className={cn("truncate text-body font-semibold", hero ? "text-white" : "text-neutral-800")}>{account.ceo_name}</p>
                <p className={cn("text-caption", hero ? "text-white/60" : "text-neutral-500")}>{CEO_TITLE}</p>
              </div>
            </div>
          ) : (
            <p className={cn("text-body-sm", hero ? "text-white/60" : "text-neutral-400")}>
              Not set yet
              {canEdit && (
                <Link href="/settings/company" className={cn("ml-1.5 font-semibold hover:underline", hero ? "text-secondary-300" : "text-secondary-700")}>
                  Add
                </Link>
              )}
            </p>
          )}
        </div>

        <div
          className={cn(
            "border-t pt-3.5 md:border-l md:border-t-0",
            hero ? "border-white/15 pb-1 md:pl-5" : "border-neutral-100 px-5 pb-4"
          )}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                "inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide",
                hero ? "text-white/55" : "text-neutral-400"
              )}
            >
              Sales &amp; Marketing
              {team.length > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-caption font-semibold normal-case tracking-normal",
                    hero ? "bg-white/15 text-white/80" : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {team.length}
                </span>
              )}
            </p>
            {canEdit && (
              <Link
                href="/settings/company#sales-marketing"
                aria-label="Add a Sales & Marketing person"
                className={cn(
                  "flex size-[26px] items-center justify-center rounded-md border border-dashed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
                  hero
                    ? "border-white/30 text-white/70 hover:border-white/60 hover:bg-white/10 hover:text-white"
                    : "border-neutral-300 text-neutral-500 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-700"
                )}
              >
                <Plus className="size-3.5" />
              </Link>
            )}
          </div>
          {team.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {team.map((person, i) => (
                <li
                  key={`${person}-${i}`}
                  className={cn(
                    "inline-flex items-center gap-[7px] rounded-full border py-[3px] pl-[3px] pr-2.5 text-body-sm font-medium",
                    hero ? "border-white/15 bg-white/10 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-700"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                      hero ? "bg-white/20 text-white" : "bg-secondary-100 text-secondary-800"
                    )}
                  >
                    {initials(person)}
                  </span>
                  {person}
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("text-body-sm", hero ? "text-white/60" : "text-neutral-400")}>
              None added yet
              {canEdit && (
                <Link href="/settings/company#sales-marketing" className={cn("ml-1.5 font-semibold hover:underline", hero ? "text-secondary-300" : "text-secondary-700")}>
                  Add
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
