import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Lands invite/recovery email links here (PKCE `code` exchange). If the
 * code is missing/expired, no session gets established and we still
 * redirect to `next` — the destination page is responsible for detecting
 * "no session" and showing its own spec'd error state (App Flow §4.1
 * A3's inline "link expired" message, or a 404 for A4 per §6's general
 * broken-link rule) rather than this route guessing at one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
