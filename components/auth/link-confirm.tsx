"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "magiclink", "email", "email_change"];

/** Only same-site paths, so a crafted link can't send someone elsewhere after signing in. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/headquarters";
  return raw;
}

type State =
  | { kind: "working" }
  | { kind: "ready"; tokenHash: string; type: EmailOtpType }
  | { kind: "expired" };

/**
 * Where invite and password-reset email links land (client-confirmed fix,
 * 2026-10-19). It signs in the person the link belongs to, replacing any
 * session already in this browser, before the set-password page loads.
 *
 * Why: an invite opened in a browser where someone else was signed in
 * used to reach /accept-invite with that other session, and the form set
 * *their* password. Admin invites carry the new user's session in the URL
 * fragment (#access_token=…), which the server-side callback never sees,
 * so it fell through to whoever was already signed in. A link that had
 * already been used (Microsoft 365 Safe Links opens links to scan them,
 * and each link works once) did the same.
 *
 * Three link shapes, in the order they're tried:
 *   - `?token_hash=&type=` (the email templates' recommended form): shows
 *     a Continue button and verifies only when it's pressed, so a link
 *     scanner that merely loads the page can't use the link up;
 *   - `#access_token=&refresh_token=` (Supabase's default invite link);
 *   - `?code=` (PKCE, the forgot-password flow).
 * Anything else, or an error in the fragment, signs out the leftover
 * session and says the link has expired or was already used.
 */
export function LinkConfirm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "working" });
  const [next, setNext] = useState("/headquarters");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const target = safeNext(query.get("next"));
    setNext(target);

    const expire = async () => {
      await supabase.auth.signOut({ scope: "local" });
      setState({ kind: "expired" });
    };
    const go = () => {
      router.replace(target);
      router.refresh();
    };

    void (async () => {
      if (query.get("failed") || fragment.get("error") || fragment.get("error_code")) {
        await expire();
        return;
      }

      const tokenHash = query.get("token_hash");
      const type = query.get("type") as EmailOtpType | null;
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        setState({ kind: "ready", tokenHash, type });
        return;
      }

      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      if (accessToken && refreshToken) {
        // Drop the tokens from the address bar before anything else runs.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) await expire();
        else go();
        return;
      }

      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) await expire();
        else go();
        return;
      }

      await expire();
    })();
  }, [router]);

  const confirm = async () => {
    if (state.kind !== "ready") return;
    setSubmitting(true);
    const supabase = createClient();
    // Whoever was signed in here before is not who this link is for.
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.verifyOtp({ token_hash: state.tokenHash, type: state.type });
    if (error) {
      setSubmitting(false);
      setState({ kind: "expired" });
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const isReset = next.startsWith("/reset-password");

  if (state.kind === "working") {
    return <p className="text-center text-body text-neutral-600">Signing you in…</p>;
  }

  if (state.kind === "ready") {
    return (
      <>
        <h1 className="mb-2 text-h3 text-primary-900">
          {state.type === "recovery" ? "Reset your password" : "Accept your invite"}
        </h1>
        <p className="mb-6 text-body text-neutral-600">
          {state.type === "recovery"
            ? "Continue to choose a new password for your GrowthMission account."
            : "Continue to set your password and open GrowthMission."}
        </p>
        <Button className="w-full" onClick={() => void confirm()} disabled={submitting}>
          {submitting ? "Signing you in…" : "Continue"}
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-h3 text-primary-900">Link expired</h1>
      <p className="mb-4 text-body text-neutral-600">
        {isReset
          ? "This password reset link has expired or was already used."
          : "This invite link has expired or was already used. Ask the person who invited you to send a new invite."}
      </p>
      <Link href={isReset ? "/forgot-password" : "/login"} className="text-body text-primary-700 hover:underline">
        {isReset ? "Request a new reset link" : "Go to sign in"}
      </Link>
    </>
  );
}
