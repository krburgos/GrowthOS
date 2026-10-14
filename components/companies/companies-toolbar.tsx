"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ANY = "__any__";

/**
 * Search and filters for Companies (client-confirmed, 2026-10-14, "CRM
 * Pages Refresh"). Every control writes the URL, and the page filters the
 * full set before paginating, so a filter never covers only the current
 * page. Changing one returns to page 1. Search waits for a pause in typing
 * before it updates the URL.
 */
export function CompaniesToolbar({
  industries,
  states,
  bands,
}: {
  industries: string[];
  states: string[];
  bands: string[];
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
  const pick = (key: string, placeholder: string, options: { value: string; label: string }[]) => (
    <Select value={params.get(key) ?? ANY} onValueChange={(v) => push({ [key]: v === ANY ? null : v })}>
      <SelectTrigger aria-label={placeholder} className="h-9 w-full bg-white text-body-sm sm:w-auto sm:min-w-[150px]">
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
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search company, website or city"
          className="h-9 pl-9"
          aria-label="Search companies"
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
        {pick("industry", "Any industry", industries.map((v) => ({ value: v, label: v })))}
        {pick("state", "Any state", states.map((v) => ({ value: v, label: v })))}
        {pick("min", "Any size", bands.map((b) => ({ value: b, label: `${b}+ employees` })))}
        {pick("open", "Any opportunity", [{ value: "1", label: "Has an open opportunity" }])}
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            setTerm("");
            push({ q: null, industry: null, state: null, min: null, open: null });
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption font-semibold text-secondary-700 hover:text-secondary-800"
        >
          <X className="size-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
