import type { Metadata } from "next";

import { PasswordForm } from "@/components/settings/password-form";
import { ProfileBanner } from "@/components/settings/profile-banner";
import { getCurrentUser } from "@/lib/auth/get-current-user";

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

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <ProfileBanner
        title={user.full_name}
        avatar={<span className="text-body-sm font-medium text-neutral-500">{initials(user.full_name)}</span>}
      />
      <PasswordForm />
    </main>
  );
}
