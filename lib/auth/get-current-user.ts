import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type UserRole =
  | "msp_owner"
  | "msp_admin"
  | "msp_sales"
  | "msp_marketing"
  | "msp_read_only"
  | "cro_admin"
  | "cro_advisor"
  | "cro_service_team"
  | "partner";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_id: string | null;
  /** Set only while a CRO Leader/partner session is "viewing as" an MSP account. */
  viewingAccountName?: string;
}

const CRO_LEADER_ROLES: UserRole[] = ["cro_admin", "cro_advisor", "cro_service_team"];

export const VIEWING_ACCOUNT_COOKIE = "growthos_viewing_account_id";

export function isCroLeaderRole(role: UserRole) {
  return CRO_LEADER_ROLES.includes(role);
}

/** Both CRO Leader and partner sessions have no home account_id — they only ever get one via "viewing as." */
export function needsAccountSelection(role: UserRole) {
  return isCroLeaderRole(role) || role === "partner";
}

/**
 * Resolves the authenticated session plus the linked public.users profile
 * (role, account_id) used for role-based landing/nav throughout the (app)
 * shell. Returns null when there's no session — callers redirect to /login.
 *
 * Client-confirmed addition (2026-09-08) — CRO Leader and partner roles
 * carry no account_id of their own (Backend Schema §3); once one of
 * them "enters" an MSP account from /cro (POST /api/cro/enter sets the
 * VIEWING_ACCOUNT_COOKIE), this resolves that account transparently
 * into the returned `account_id` — every existing MSP-shell page
 * already reads `user.account_id` directly, so nothing else needed to
 * change for "viewing as" to work end to end. A partner's cookie value
 * is only honored if a matching partner_account_grants row actually
 * exists (RLS also enforces this independently; this check just avoids
 * silently no-op'ing every query for a stale/revoked grant) — a CRO
 * Leader's is honored unconditionally, since is_cro_leader() already
 * grants unrestricted account access at the RLS layer.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, role, account_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const currentUser = profile as CurrentUser;

  if (needsAccountSelection(currentUser.role)) {
    const cookieStore = await cookies();
    const viewingAccountId = cookieStore.get(VIEWING_ACCOUNT_COOKIE)?.value;

    if (viewingAccountId) {
      let allowed = true;
      if (currentUser.role === "partner") {
        const { data: grant } = await supabase
          .from("partner_account_grants")
          .select("id")
          .eq("partner_user_id", currentUser.id)
          .eq("account_id", viewingAccountId)
          .maybeSingle();
        allowed = !!grant;
      }

      if (allowed) {
        const { data: account } = await supabase
          .from("accounts")
          .select("id, name")
          .eq("id", viewingAccountId)
          .is("archived_at", null)
          .maybeSingle();

        if (account) {
          currentUser.account_id = account.id;
          currentUser.viewingAccountName = account.name;
        }
      }
    }
  }

  return currentUser;
}
