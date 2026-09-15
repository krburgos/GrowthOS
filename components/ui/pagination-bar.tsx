"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

/**
 * Client-confirmed (2026-09-15) — a 10/25/50/100 rows-per-page control
 * plus Prev/Next, shared by every list/table page so a large account
 * never has to render an unbounded page. Reads/writes `page`/`pageSize`
 * on the current URL directly (preserving every other search param,
 * e.g. `sort`/`dir`), so it needs nothing passed in but the numbers
 * themselves -- no basePath or callback wiring per page.
 */
export function PaginationBar({
  page,
  pageSize,
  totalCount,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const navigate = (nextPage: number, nextPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-body-sm text-neutral-500">
      <span>
        Showing <span className="font-medium text-neutral-700">{rangeStart}–{rangeEnd}</span> of{" "}
        <span className="font-medium text-neutral-700">{totalCount}</span>
      </span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => navigate(1, Number(v))}>
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
            onClick={() => navigate(page - 1, pageSize)}
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
            onClick={() => navigate(page + 1, pageSize)}
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
