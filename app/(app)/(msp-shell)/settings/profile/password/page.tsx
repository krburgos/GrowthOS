import type { Metadata } from "next";

import { PasswordForm } from "@/components/settings/password-form";
import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import { HeroBand } from "@/components/shell/hero-band";
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
    <main className="w-full max-w-[900px] flex-1 p-6 md:p-8">
      {/* Same identity band as My Profile, so moving between the two does not
          change the look of the page you are on. */}
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
            <p className="truncate text-body-sm text-white/75">{user.email}</p>
          </div>
        </div>
      </HeroBand>
      <PasswordForm />
    </main>
  );
}
