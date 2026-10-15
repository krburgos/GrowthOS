"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { FilterField, FilterResult, FilterTitle, filterTriggerClass } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ANY = "__any__";

/**
 * Search and filters for Companies (client-confirmed, 2026-10-14, "CRM
 * Pages Refresh"). Every control writes the URL, and the page filters the
 * full set before paginating, so a filter never covers only the current
 * page. Changing one returns to page 1. Search waits for a pause in typing
 * before it updates the URL.
 *
 * Client-confirmed (2026-10-15, "Table Filters"): each control is named,
 * a filtering one turns blue, and a filtered table says how many companies
 * it is showing, with Clear filters beside it.
 */
export function CompaniesToolbar({
  industries,
  states,
  bands,
  shown,
  total,
}: {
  industries: string[];
  states: string[];
  bands: string[];
  /** Companies left after search and filters, and the account's total. */
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");

  const push = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if ((params.get("q") ?? "") === term) return;
    const t = setTimeout(() => push({ q: term.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const active = ["q", "industry", "state", "min", "open"].some((k) => params.get(k));
  const pick = (key: string, label: string, placeholder: string, options: { value: string; label: string }[]) => (
    <FilterField label={label}>
      <Select value={params.get(key) ?? ANY} onValueChange={(v) => push({ [key]: v === ANY ? null : v })}>
        <SelectTrigger
          aria-label={label}
          className={`h-9 w-full text-body-sm sm:w-auto sm:min-w-[150px] ${filterTriggerClass(!!params.get(key))}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );

  const clear = () => {
    setTerm("");
    push({ q: null, industry: null, state: null, min: null, open: null });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
      <FilterField label="Search" className="w-full sm:w-72">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Company, website or city"
            className="h-9 pl-9"
            aria-label="Search companies"
          />
        </div>
      </FilterField>
      <span className="hidden sm:inline-flex sm:h-9 sm:items-center">
        <FilterTitle />
      </span>
      <div className="grid w-full grid-cols-2 gap-x-2 gap-y-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
        {pick("industry", "Industry", "Any industry", industries.map((v) => ({ value: v, label: v })))}
        {pick("state", "State", "Any state", states.map((v) => ({ value: v, label: v })))}
        {pick("min", "Employees", "Any size", bands.map((b) => ({ value: b, label: `${b}+ employees` })))}
        {pick("open", "Opportunity", "Any", [{ value: "1", label: "Has an open opportunity" }])}
      </div>
      {active && <FilterResult shown={shown} total={total} noun="companies" onClear={clear} />}
    </div>
  );
}
