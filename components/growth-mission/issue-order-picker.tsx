"use client";

import { ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { SHORT_TITLE } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";

/**
 * Issue order on the overview tables (client-confirmed, 2026-10-18,
 * approved mockup "Issue Order from Headquarters"). An order is always
 * written on its own Mission Card, so this only asks which one, then
 * opens that card with the empty order panel showing (?issue=1).
 *
 * The list follows the Mission Cards' own order, each with its open-order
 * count. AdvocateDash is left out: it runs on drop-by targets, not orders.
 */
export function IssueOrderPicker({ openBySlug }: { openBySlug: Record<string, number> }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const steps = PLAYBOOK_STEPS.filter((s) => s.slug !== ADVOCATE_DASH_SLUG)
    .map((s) => ({ slug: s.slug, name: SHORT_TITLE[s.slug] ?? s.title }))
    .filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" className="ml-auto border-transparent hover:border-transparent">
          <Plus className="mr-1.5 size-4" />
          Issue order
          <ChevronDown className="ml-1 size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] max-w-[calc(100vw-32px)] p-0">
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-3.5 pb-2.5 pt-3">
          <p className="text-body-sm font-semibold text-primary-900">Which Mission Card is it for?</p>
          <label className="flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-2.5 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a Mission Card"
              aria-label="Find a Mission Card"
              className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </label>
        </div>
        <ul className="max-h-[320px] overflow-y-auto py-1">
          {steps.length === 0 ? (
            <li className="px-3.5 py-3 text-body-sm text-neutral-400">No Mission Card matches.</li>
          ) : (
            steps.map((s) => {
              const open = openBySlug[s.slug] ?? 0;
              return (
                <li key={s.slug}>
                  <Link
                    href={`/growth-mission/${s.slug}?issue=1`}
                    className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-body-sm text-neutral-800 outline-none hover:bg-primary-50 hover:font-semibold hover:text-primary-900 focus-visible:bg-primary-50 focus-visible:text-primary-900"
                  >
                    <span className="min-w-0">{s.name}</span>
                    <span className="shrink-0 text-caption font-normal tabular-nums text-neutral-400">
                      {open > 0 ? `${open} open` : "none yet"}
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-neutral-100 px-3.5 py-2 text-caption text-neutral-500">
          Opens the Mission Card with a new order ready.
        </p>
      </PopoverContent>
    </Popover>
  );
}
