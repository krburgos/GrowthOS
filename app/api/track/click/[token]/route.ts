import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backend Schema §9 — GET /api/track/click/[token], public, no session.
 * Records a 'clicked' event and 302-redirects to the real destination
 * (the `url` query param, set by lib/email/build-campaign-html.ts when
 * it rewrote every bare URL in the campaign body). Falls back to the
 * app's own homepage if `url` is missing/malformed rather than erroring.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const destination = request.nextUrl.searchParams.get("url");

  const supabase = createAdminClient();
  await supabase.rpc("record_campaign_event", {
    p_tracking_token: token,
    p_event_type: "clicked",
    p_metadata: destination ? { url: destination } : null,
  });

  let redirectUrl = new URL("/", request.url);
  if (destination) {
    try {
      redirectUrl = new URL(destination);
    } catch {
      // Malformed destination — fall back to the homepage above.
    }
  }

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
