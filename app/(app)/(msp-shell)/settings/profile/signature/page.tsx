import type { Metadata } from "next";

import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import { SignatureForm } from "@/components/settings/signature-form";
import { HeroBand } from "@/components/shell/hero-band";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Email Signature — GrowthMission" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * My Profile → Email Signature (client-confirmed, 2026-10-20, approved
 * mockup "Email Templates and Signature"). One signature per person, added
 * to the emails they send from Contact Detail. Same identity band as the
 * other My Profile pages.
 */
export default async function SignaturePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: account }] = await Promise.all([
    supabase
      .from("users")
      .select("avatar_url, phone, job_title, email_signature_html, email_signature_auto")
      .eq("id", user.id)
      .single(),
    user.account_id
      ? supabase.from("accounts").select("name, website").eq("id", user.account_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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
            <p className="truncate text-body-sm text-white/75">{user.email}</p>
          </div>
        </div>
      </HeroBand>
      <SignatureForm
        userId={user.id}
        initialHtml={profile?.email_signature_html ?? ""}
        initialAuto={profile?.email_signature_auto ?? true}
        details={{
          name: user.full_name,
          title: profile?.job_title ?? null,
          company: (account as { name?: string } | null)?.name ?? null,
          phone: profile?.phone ?? null,
          website: (account as { website?: string | null } | null)?.website ?? null,
        }}
      />
    </main>
  );
}
