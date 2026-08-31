"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Design System §8.5 — sort-arrow icon (neutral-400, secondary-800 when
 * the column is the active sort) to the right of the column label.
 * Server-driven sort via URL search params rather than client-side
 * table state, so it scales to the "tens of thousands of records" per
 * tenant the PRD (§6.1) calls for.
 */
export function SortableHeader({ field, label }: { field: string; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSort = searchParams.get("sort");
  const activeDir = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const isActive = activeSort === field;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(searchParams.toString());
  params.set("sort", field);
  params.set("dir", nextDir);

  const Icon = isActive ? (activeDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <Link href={`${pathname}?${params.toString()}`} className="flex items-center gap-1 hover:text-neutral-800">
      {label}
      <Icon className={cn("size-3.5", isActive ? "text-secondary-800" : "text-neutral-400")} />
    </Link>
  );
}
