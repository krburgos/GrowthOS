import type { Metadata } from "next";

import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import { ProfileForm } from "@/components/settings/profile-form";
import { HeroBand } from "@/components/shell/hero-band";
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
 *
 * Client-confirmed redesign (2026-09-22, approved mockup "B"): identity
 * moves into the app's navy HeroBand, replacing the gradient-with-a-radial-
 * glow banner that existed only on this screen and Company Profile. The
 * page is capped at 900px so a short value sits near its label instead of
 * floating in a line the full width of a 1440px page.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("phone, job_title, linkedin_url, avatar_url")
    .eq("id", user.id)
    .single();

  const identityLine = [profile?.job_title, ROLE_LABELS[user.role], user.email].filter(Boolean).join(" · ");

  return (
    <main className="w-full max-w-[900px] flex-1 p-6 md:p-8">
      <HeroBand className="mb-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25">
            <ProfileAvatarUpload
              userId={user.id}
              avatarUrl={profile?.avatar_url ?? null}
              fallbackText={initials(user.full_name)}
              compact
              onDark
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-h2 text-white">{user.full_name}</h1>
            <p className="truncate text-body-sm text-white/75">{identityLine}</p>
          </div>
        </div>
      </HeroBand>

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
