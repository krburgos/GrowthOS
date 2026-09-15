"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

/**
 * Controlled sibling of `PaginationBar` (components/ui/pagination-bar.tsx)
 * for lists that don't have their own page/URL to read `page`/`pageSize`
 * from -- the CRO Leader Dashboard's Accounts and Partners lists are both
 * client-filtered, fully-fetched arrays on one shared page, so two
 * independent tables can't both own the URL's `page`/`pageSize` params
 * without colliding. Same visual bar, driven by props + callbacks instead.
 */
export function LocalPaginationBar({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-body-sm text-neutral-500">
      <span>
        Showing <span className="font-medium text-neutral-700">{rangeStart}–{rangeEnd}</span> of{" "}
        <span className="font-medium text-neutral-700">{totalCount}</span>
      </span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              onPageSizeChange(Number(v));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex size-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-16 text-center tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex size-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
