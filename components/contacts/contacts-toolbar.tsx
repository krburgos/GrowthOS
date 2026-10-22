"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ContactsFilterButton } from "@/components/contacts/contacts-filter-panel";
import { FilterField } from "@/components/ui/filter-bar";
import type { RuleOptions } from "@/lib/contacts/filters";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ContactView = "all" | "mine" | "new" | "hot";

/**
 * Views and search on the Contacts table's own toolbar row
 * (client-confirmed, 2026-10-14, "CRM Pages Refresh"). Both write the URL
 * and the page filters on the server, so they cover every contact, not
 * only the loaded page. They only filter the table: they never create or
 * change a list, so they are not the Smart Lists the client removed
 * (2026-09-06). Search waits for a pause in typing.
 *
 * Client-confirmed (2026-10-15, "Table Filters"): both controls are named,
 * "Show" and "Search", like every table's filter row.
 */
export function ContactsToolbar({
  view,
  counts,
  filterOptions,
}: {
  view: ContactView;
  counts: Record<ContactView, number>;
  /** The filter panel's choices (client-confirmed, 2026-10-22). */
  filterOptions: RuleOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  useEffect(() => {
    if ((params.get("q") ?? "") === term) return;
    const t = setTimeout(() => router.replace(href({ q: term.trim() || null }), { scroll: false }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const views: [ContactView, string][] = [
    ["all", "All"],
    ["mine", "Mine"],
    ["new", "New this month"],
    ["hot", "Hot"],
  ];

  return (
    <div className="flex w-full flex-wrap items-end gap-x-3 gap-y-2.5 lg:w-auto">
      <FilterField label="Show" className="max-w-full">
      <nav aria-label="Contact views" className="flex max-w-full overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-1 shadow-inner">
        {views.map(([v, label]) => (
          <Link
            key={v}
            href={href({ view: v === "all" ? null : v })}
            aria-current={view === v ? "page" : undefined}
            scroll={false}
            className={cn(
              "whitespace-nowrap rounded px-3 py-1 text-body-sm font-medium transition-colors",
              view === v ? "bg-white text-primary-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            {label} <span className="tabular-nums text-neutral-400">{counts[v].toLocaleString()}</span>
          </Link>
        ))}
      </nav>
      </FilterField>
      <FilterField label="Search" className="w-full sm:w-72">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name or email"
            className="h-9 pl-9"
            aria-label="Search contacts"
          />
        </div>
      </FilterField>
      <ContactsFilterButton options={filterOptions} />
    </div>
  );
}
