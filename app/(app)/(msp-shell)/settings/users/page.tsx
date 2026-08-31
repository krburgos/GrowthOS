import type { Metadata } from "next";

import { InviteUserDialog } from "@/components/settings/invite-user-dialog";
import { UsersTable, type UserRow } from "@/components/settings/users-table";
import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";
import { CRO_LEADER_ROLES, MSP_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users & Roles — GrowthOS" };

/**
 * App Flow §4.9, I1 — Users & Roles. Owner/Admin (own account) or CRO
 * Admin (any account) can invite/deactivate/change roles; other roles in
 * the account can view (Backend Schema §2's broad-view interpretation).
 * CRO Admin's cross-account entry point (search + enter an MSP) is
 * Milestone 11 — this screen is account-scoped for now.
 */
export default async function UsersRolesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (isCroLeaderRole(user.role) && !user.account_id) {
    return (
      <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
        <h1 className="mb-2 text-h1 text-primary-900">Users & Roles</h1>
        <p className="text-body text-neutral-500">
          Select an MSP account from the CRO Leader Dashboard to manage its users.
        </p>
      </main>
    );
  }

  const canEdit = user.role === "msp_owner" || user.role === "msp_admin" || user.role === "cro_admin";

  const supabase = await createClient();

  const [{ data: rows }, { data: lastLogins }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role, archived_at")
      .eq("account_id", user.account_id)
      .order("full_name"),
    supabase.rpc("get_users_with_last_login", { p_account_id: user.account_id }),
  ]);

  const lastLoginById = new Map(
    (lastLogins as { user_id: string; last_sign_in_at: string | null }[] | null ?? []).map(
      (r) => [r.user_id, r.last_sign_in_at]
    )
  );

  const users: UserRow[] = (rows ?? []).map((r) => ({
    ...r,
    last_sign_in_at: lastLoginById.get(r.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Users & Roles</h1>
        {canEdit && <InviteUserDialog inviteableRoles={user.role === "cro_admin" ? [...MSP_ROLES, ...CRO_LEADER_ROLES] : MSP_ROLES} />}
      </div>
      <UsersTable
        users={users}
        assignableRoles={user.role === "cro_admin" ? [...MSP_ROLES, ...CRO_LEADER_ROLES] : MSP_ROLES}
        canEdit={canEdit}
        currentUserId={user.id}
      />
    </main>
  );
}
