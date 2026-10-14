import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-confirmed "select all N items" is a true cross-query selection
 * (every contact matching the current view, not just what's loaded on
 * screen) — resolved here to a concrete id array so every bulk action
 * (Delete/Assign/Mark as/Add to/Export) can operate the same way
 * whether the user checked rows individually or hit "Select all."
 */
export type ContactSelectionScope =
  | { mode: "all-contacts"; accountId: string; filter?: ContactFilter }
  | { mode: "list"; listId: string };

/**
 * The Contacts page's view and search (client-confirmed, 2026-10-14). They
 * travel with the scope so "Select all N" resolves to exactly the N on
 * screen: without them, select-all-then-Delete under the Hot view would
 * have archived every contact in the account.
 */
export interface ContactFilter {
  ownerId?: string;
  createdSince?: string;
  hot?: boolean;
  /** Matched against full name and email. */
  term?: string;
}

export async function resolveContactIds(
  supabase: SupabaseClient,
  selection: { selectAllMatching: boolean; selectedIds: string[] },
  scope: ContactSelectionScope
): Promise<string[]> {
  if (!selection.selectAllMatching) return selection.selectedIds;

  if (scope.mode === "all-contacts") {
    let query = supabase.from("contacts").select("id").eq("account_id", scope.accountId).is("archived_at", null);
    const f = scope.filter;
    if (f?.ownerId) query = query.eq("owner_id", f.ownerId);
    if (f?.createdSince) query = query.gte("created_at", f.createdSince);
    if (f?.hot) query = query.eq("temperature", "hot");
    if (f?.term) query = query.or(`full_name.ilike.%${f.term}%,email.ilike.%${f.term}%`);
    const { data } = await query.limit(5000);
    return (data ?? []).map((r) => r.id);
  }

  const { data } = await supabase.from("list_members").select("contact_id").eq("list_id", scope.listId);
  return (data ?? []).map((r) => r.contact_id);
}

/** Supabase's .in() has a practical URL-length limit — chunk large id
 * arrays so a "select all 5,000" bulk action doesn't fail outright. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
