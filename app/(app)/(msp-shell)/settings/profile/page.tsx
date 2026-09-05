import type { Metadata } from "next";

import { ProfileBanner } from "@/components/settings/profile-banner";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Profile — GrowthOS" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * App Flow §4.9, I4 — My Profile. All MSP roles, own profile only. Role
 * and account are read-only here (enforced by the UI and by the
 * prevent_self_role_escalation trigger on the users table).
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("phone, job_title, linkedin_url")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <ProfileBanner
        title={user.full_name}
        avatar={<span className="text-body-sm font-medium text-neutral-500">{initials(user.full_name)}</span>}
      />
      <ProfileForm
        userId={user.id}
        fullName={user.full_name}
        email={user.email}
        roleLabel={ROLE_LABELS[user.role]}
        phone={profile?.phone ?? ""}
        jobTitle={profile?.job_title ?? ""}
        linkedinUrl={profile?.linkedin_url ?? ""}
      />
    </main>
  );
}
