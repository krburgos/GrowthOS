import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import { safeNext } from "@/lib/auth/safe-next";

export const metadata: Metadata = { title: "Log In — GrowthMission" };

/**
 * Log In (A1). Client-confirmed (2026-10-19, approved mockup "Sign-in
 * Routing"):
 *   - someone already signed in skips the form, to the page they asked
 *     for or their home (the CRO Dashboard for CRO Leader and partners
 *     who haven't entered an account, Headquarters otherwise);
 *   - a line says why they're here: after Reset password, after Log out,
 *     or after opening a page while signed out (proxy.ts adds `next`).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; signed_out?: string; next?: string }>;
}) {
  const { reset, signed_out: signedOut, next: rawNext } = await searchParams;
  const next = rawNext ? safeNext(rawNext, "") : "";

  const user = await getCurrentUser();
  if (user) {
    const home = needsAccountSelection(user.role) && !user.account_id ? "/cro" : "/headquarters";
    redirect(next || home);
  }

  const notice =
    reset === "1"
      ? { tone: "ok", text: "Password updated. Log in with your new password." }
      : signedOut === "1"
        ? { tone: "info", text: "You've been signed out." }
        : next
          ? { tone: "info", text: "Log in to continue to the page you opened." }
          : null;

  return (
    <>
      <h1 className="mb-6 text-h3 text-primary-900">Log in to GrowthMission</h1>
      {notice && (
        <p
          role="status"
          className={
            notice.tone === "ok"
              ? "mb-4 rounded-md bg-success-50 px-3 py-2 text-body-sm text-success-800"
              : "mb-4 rounded-md bg-primary-100 px-3 py-2 text-body-sm text-primary-900"
          }
        >
          {notice.text}
        </p>
      )}
      <LoginForm next={next || null} />
    </>
  );
}
