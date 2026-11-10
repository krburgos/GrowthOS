import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/**
 * How a company name and website were resolved (Backend Schema §7.3,
 * client-confirmed 2026-11-10): an existing live company, a deleted one
 * brought back with its earlier details, or a new one.
 */
export type CompanyMatchStatus = "matched" | "restored" | "created";

export interface CompanyMatch {
  id: string;
  status: CompanyMatchStatus;
}

/**
 * Finds, restores or creates the company through
 * match_or_create_company_detail(). `fill` holds the values the person or
 * the import row typed in: on a restored or new company each one that isn't
 * blank is written over the old value, so a returning company picks up a new
 * employee count while blanks keep what it had. A live match is linked as is.
 *
 * Until migration 20261110000001 is run the detail function doesn't exist;
 * the old match_or_create_company() is used instead, so adding contacts keeps
 * working (without restores).
 */
export async function matchOrCreateCompany(
  supabase: SupabaseClient,
  accountId: string,
  name: string,
  website: string | null,
  fill?: Record<string, string | null | undefined>
): Promise<{ data: CompanyMatch | null; error: PostgrestError | null }> {
  let match: CompanyMatch | null = null;
  const detail = await supabase.rpc("match_or_create_company_detail", {
    p_account_id: accountId,
    p_name: name,
    p_domain: website || null,
  });
  if (!detail.error && detail.data) {
    match = detail.data as CompanyMatch;
  } else if (detail.error?.code === "PGRST202") {
    const old = await supabase.rpc("match_or_create_company", {
      p_account_id: accountId,
      p_name: name,
      p_domain: website || null,
    });
    if (old.error || !old.data) return { data: null, error: old.error };
    match = { id: old.data as string, status: "created" };
  } else {
    return { data: null, error: detail.error };
  }

  if (fill && match.status !== "matched") {
    const patch = Object.fromEntries(
      Object.entries(fill).filter(([, v]) => typeof v === "string" && v.trim() !== "").map(([k, v]) => [k, (v as string).trim()])
    );
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("companies").update(patch).eq("id", match.id);
      if (error) return { data: match, error };
    }
  }
  return { data: match, error: null };
}
