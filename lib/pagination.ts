export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Client-confirmed (2026-09-15) — shared page/pageSize parsing for every
 * server-rendered list page, so a bad/missing query param always falls
 * back to page 1 at the default size rather than an unbounded query.
 * `from`/`to` plug straight into Supabase's `.range(from, to)`.
 */
export function parsePagination(params: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Math.trunc(Number(params.page)) || 1);
  const pageSizeRaw = Math.trunc(Number(params.pageSize));
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
