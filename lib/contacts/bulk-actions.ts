import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-confirmed "select all N items" is a true cross-query selection
 * (every contact matching the current view, not just what's loaded on
 * screen) — resolved here to a concrete id array so every bulk action
 * (Delete/Assign/Mark as/Add to/Export) can operate the same way
 * whether the user checked rows individually or hit "Select all."
 */
export type ContactSelectionScope =
  | { mode: "all-contacts"; accountId: string }
  | { mode: "list"; listId: string; listType: "static" | "smart" };

export async function resolveContactIds(
  supabase: SupabaseClient,
  selection: { selectAllMatching: boolean; selectedIds: string[] },
  scope: ContactSelectionScope
): Promise<string[]> {
  if (!selection.selectAllMatching) return selection.selectedIds;

  if (scope.mode === "all-contacts") {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", scope.accountId)
      .is("archived_at", null)
      .limit(5000);
    return (data ?? []).map((r) => r.id);
  }

  if (scope.listType === "static") {
    const { data } = await supabase.from("list_members").select("contact_id").eq("list_id", scope.listId);
    return (data ?? []).map((r) => r.contact_id);
  }

  const { data } = await supabase.rpc("compute_smart_list_members", { p_list_id: scope.listId });
  return (data ?? []).map((r: { contact_id: string }) => r.contact_id);
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
