import type { Metadata } from "next";

import { PasswordForm } from "@/components/settings/password-form";
import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import { ProfileBanner } from "@/components/settings/profile-banner";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Password — GrowthOS" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Its own Settings destination, separate from Contact Information
 * (client-confirmed — the two were stacked on one page, now split).
 */
export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("avatar_url").eq("id", user.id).single();

  return (
    <main className="w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <ProfileBanner
        title={user.full_name}
        avatar={
          <ProfileAvatarUpload
            userId={user.id}
            avatarUrl={profile?.avatar_url ?? null}
            fallbackText={initials(user.full_name)}
          />
        }
      />
      <PasswordForm />
    </main>
  );
}
