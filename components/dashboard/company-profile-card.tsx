import { Globe, Link as LinkIcon, MapPin, Pencil, Phone, Plus } from "lucide-react";
import Link from "next/link";

import {
  displayUrl,
  externalHref,
  formatAddress,
  initials,
  type CompanyProfile,
} from "@/lib/accounts/company-profile";

const CEO_TITLE = "Chief Executive Officer";

function ContactItem({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-[15px] shrink-0 text-neutral-400" />
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
 */
export function CompanyProfileCard({ account, canEdit }: { account: CompanyProfile; canEdit: boolean }) {
  const address = formatAddress(account);
  const team = account.sales_marketing_names.filter((n) => n.trim());

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white" aria-label="Company profile">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5 px-5 py-4">
        {account.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.logo_url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-800 to-secondary-700 text-h3 font-bold text-white">
            {initials(account.name)}
          </span>
        )}

        <div className="min-w-[240px] flex-1">
          <p className="text-caption font-semibold text-neutral-400">Company profile</p>
          <h2 className="mb-1 text-h3 font-semibold leading-tight text-primary-900">{account.name}</h2>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-body-sm text-neutral-600">
            {address && <ContactItem icon={MapPin}>{address}</ContactItem>}
            {account.phone && <ContactItem icon={Phone}>{account.phone}</ContactItem>}
            {account.website && (
              <ContactItem icon={Globe}>
                <a
                  href={externalHref(account.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-secondary-700 hover:underline"
                >
                  {displayUrl(account.website)}
                </a>
              </ContactItem>
            )}
            {account.linkedin_url && (
              <ContactItem icon={LinkIcon}>
                <a
                  href={externalHref(account.linkedin_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-secondary-700 hover:underline"
                >
                  LinkedIn
                </a>
              </ContactItem>
            )}
            {!address && !account.phone && !account.website && !account.linkedin_url && (
              <span className="text-neutral-400">No contact details yet</span>
            )}
          </div>
        </div>

        {canEdit && (
          <Link
            href="/settings/company"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-body-sm font-semibold text-secondary-700 hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            <Pencil className="size-4" />
            Edit profile
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 border-t border-neutral-100 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,2.1fr)]">
        <div className="px-5 pb-4 pt-3.5">
          <p className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-neutral-400">CEO</p>
          {account.ceo_name ? (
            <div className="flex items-center gap-2.5">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                {initials(account.ceo_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-neutral-800">{account.ceo_name}</p>
                <p className="text-caption text-neutral-500">{CEO_TITLE}</p>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-neutral-400">
              Not set yet
              {canEdit && (
                <Link href="/settings/company" className="ml-1.5 font-semibold text-secondary-700 hover:underline">
                  Add
                </Link>
              )}
            </p>
          )}
        </div>

        <div className="border-t border-neutral-100 px-5 pb-4 pt-3.5 md:border-l md:border-t-0">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-400">
              Sales &amp; Marketing
              {team.length > 0 && (
                <span className="rounded-full bg-neutral-100 px-1.5 text-caption font-semibold normal-case tracking-normal text-neutral-500">
                  {team.length}
                </span>
              )}
            </p>
            {canEdit && (
              <Link
                href="/settings/company#sales-marketing"
                aria-label="Add a Sales & Marketing person"
                className="flex size-[26px] items-center justify-center rounded-md border border-dashed border-neutral-300 text-neutral-500 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
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
                  className="inline-flex items-center gap-[7px] rounded-full border border-neutral-200 bg-neutral-50 py-[3px] pl-[3px] pr-2.5 text-body-sm font-medium text-neutral-700"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-semibold text-secondary-800">
                    {initials(person)}
                  </span>
                  {person}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-neutral-400">
              None added yet
              {canEdit && (
                <Link href="/settings/company#sales-marketing" className="ml-1.5 font-semibold text-secondary-700 hover:underline">
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
