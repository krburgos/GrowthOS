"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Sortable column headings for the Mission Card tables (client-confirmed,
 * 2026-10-22): Campaigns, the Call Queue and the Arsenal. These tables hold
 * every row in the browser already, so they sort there rather than through
 * the address the way SortableHeader does for the server-paged tables. Same
 * arrows (Design System §8.5), coloured for the light blue heading row.
 */
export type SortDir = "asc" | "desc";
type Value = string | number | null | undefined;

export function useTableSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => Value>,
  initial: { key: K; dir: SortDir } | null = null
) {
  const [sort, setSort] = useState(initial);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = accessors[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      // Blanks last, whichever way.
      if (x == null || x === "") return y == null || y === "" ? 0 : 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * sign;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  /** Props for one SortHeading. A first click sorts ascending, a second descending. */
  const headingFor = (key: K) => ({
    active: sort?.key === key,
    dir: sort?.key === key ? sort.dir : ("asc" as SortDir),
    onSort: () => setSort((s) => ({ key, dir: s?.key === key && s.dir === "asc" ? "desc" : "asc" })),
  });

  return { sorted, headingFor };
}

export function SortHeading({
  label,
  active,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onSort}
      aria-label={`Sort by ${label}${active ? `, now ${dir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wide hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
        align === "right" && "justify-self-end"
      )}
    >
      {label}
      <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", active ? "text-secondary-700" : "text-primary-300")} />
    </button>
  );
}
