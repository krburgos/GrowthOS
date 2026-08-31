import { createClient } from "@/lib/supabase/server";

export type UserRole =
  | "msp_owner"
  | "msp_admin"
  | "msp_sales"
  | "msp_marketing"
  | "msp_read_only"
  | "cro_admin"
  | "cro_advisor"
  | "cro_service_team";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_id: string | null;
}

const CRO_LEADER_ROLES: UserRole[] = ["cro_admin", "cro_advisor", "cro_service_team"];

export function isCroLeaderRole(role: UserRole) {
  return CRO_LEADER_ROLES.includes(role);
}

/**
 * Resolves the authenticated session plus the linked public.users profile
 * (role, account_id) used for role-based landing/nav throughout the (app)
 * shell. Returns null when there's no session — callers redirect to /login.
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

  return profile as CurrentUser;
}
