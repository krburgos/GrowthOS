import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands password-reset links here (PKCE `code` exchange), and invite links
 * sent before 2026-10-19.
 *
 * Client-confirmed fix (2026-10-19): a link that doesn't sign in its owner
 * must never fall through to whoever is already signed in in this browser.
 * That is how an invite opened while msp_owner@example.com was signed in
 * set msp_owner's password instead of the invitee's.
 *
 *   - A `code` that exchanges: the new session replaces the old one; go on.
 *   - A `code` that fails (expired, or already used by a mail scanner):
 *     sign the old session out and let /auth/confirm say the link expired.
 *   - No `code`: an admin invite, whose session is in the URL fragment the
 *     server can't read. /auth/confirm reads it in the browser; the
 *     fragment survives this redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const confirm = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  if (!code) {
    return NextResponse.redirect(confirm);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(`${confirm}&failed=1`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
