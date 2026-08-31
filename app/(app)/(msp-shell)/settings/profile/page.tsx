import type { Metadata } from "next";

import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";

export const metadata: Metadata = { title: "My Profile — GrowthOS" };

/**
 * App Flow §4.9, I4 — My Profile. All MSP roles, own profile only. Role
 * and account are read-only here (enforced by the UI and by the
 * prevent_self_role_escalation trigger on the users table).
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-2 text-h1 text-primary-900">My Profile</h1>
      <p className="mb-6 text-body text-neutral-500">
        {user.email} · {ROLE_LABELS[user.role]}
      </p>
      <ProfileForm userId={user.id} fullName={user.full_name} />
    </main>
  );
}
