/**
 * Every row of a read, 1,000 at a time. PostgREST returns at most 1,000
 * rows per request (Supabase's "Max rows"), and a capped read gives no
 * error, so every list that can grow past that pages through it
 * (2026-11-10 sweep: Call Queue, bulk "Select all", export, campaign sends,
 * Opportunities, Intel and more were each stopping at 1,000).
 *
 * `query` must build a fresh request each time, and `orderBy` must be a
 * column that gives a stable order (a unique one, normally the id), so the
 * pages never overlap or skip a row. Works for .from() and for .rpc() calls
 * that return a set. Stops at the first error and returns it.
 */
export async function everyRow<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: () => any,
  orderBy = "id",
  page = 1000
): Promise<{ data: T[]; error: { message: string; code?: string } | null }> {
  const out: T[] = [];
  for (let lo = 0; ; lo += page) {
    const { data, error } = await query().order(orderBy).range(lo, lo + page - 1);
    if (error) return { data: out, error };
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return { data: out, error: null };
}
