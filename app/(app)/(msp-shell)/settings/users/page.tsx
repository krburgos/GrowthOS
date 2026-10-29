import type { Metadata } from "next";

import { InviteUserDialog } from "@/components/settings/invite-user-dialog";
import { UsersTable, type UserRow } from "@/components/settings/users-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";
import { MSP_ROLES } from "@/lib/auth/roles";
import { parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users & Roles — GrowthMission" };

/**
 * App Flow §4.9, I1 — Users & Roles. Owner/Admin (own account) or CRO
 * Admin (any account) can invite/deactivate/change roles; other roles in
 * the account can view (Backend Schema §2's broad-view interpretation).
 * CRO Admin's cross-account entry point (search + enter an MSP) is
 * Milestone 11 — this screen is account-scoped for now.
 *
 * Client-confirmed (2026-10-22): only client roles are offered here, to
 * everyone including CRO Admin. The CRO Leader team, and every client's
 * users at once, are managed on the CRO Leader dashboard instead.
 */
export default async function UsersRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { page, pageSize, from, to } = parsePagination(await searchParams);

  if (isCroLeaderRole(user.role) && !user.account_id) {
    return (
      <main className="w-full max-w-[1800px] flex-1 p-6 md:p-8">
        <h1 className="mb-2 text-h1 text-primary-900">Users & Roles</h1>
        <p className="text-body text-neutral-500">
          Select an MSP account from the CRO Leader Dashboard to manage its users.
        </p>
      </main>
    );
  }

  const canEdit = user.role === "msp_owner" || user.role === "msp_admin" || user.role === "cro_admin";

  const supabase = await createClient();

  const [{ data: rows }, { count: totalCount }, { data: lastLogins }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role, archived_at")
      .eq("account_id", user.account_id)
      // Removed people are left off every user list (client-confirmed, 2026-10-22).
      .is("removed_at", null)
      .order("full_name")
      .range(from, to),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("account_id", user.account_id).is("removed_at", null),
    supabase.rpc("get_users_with_last_login", { p_account_id: user.account_id }),
  ]);

  type Login = { user_id: string; last_sign_in_at: string | null; invite_sent_at: string | null; email_confirmed_at: string | null };
  const loginById = new Map(((lastLogins as Login[] | null) ?? []).map((r) => [r.user_id, r]));

  const users: UserRow[] = (rows ?? []).map((r) => {
    const login = loginById.get(r.id);
    return {
      ...r,
      last_sign_in_at: login?.last_sign_in_at ?? null,
      invite_sent_at: login?.invite_sent_at ?? null,
      email_confirmed_at: login?.email_confirmed_at ?? null,
    };
  });

  return (
    <main className="w-full max-w-[1800px] flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Users & Roles</h1>
        {canEdit && <InviteUserDialog
            inviteableRoles={MSP_ROLES}
            accountId={user.account_id}
          />}
      </div>
      <UsersTable
        users={users}
        assignableRoles={MSP_ROLES}
        canEdit={canEdit}
        currentUserId={user.id}
      />
      <PaginationBar page={page} pageSize={pageSize} totalCount={totalCount ?? users.length} />
    </main>
  );
}
