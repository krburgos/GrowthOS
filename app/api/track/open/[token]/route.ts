import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// 1×1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

/**
 * Backend Schema §9 — GET /api/track/open/[token].gif, public, no
 * session. The URL always ends in ".gif" (some mail clients only render
 * an <img> whose src looks like an image), so the dynamic segment here
 * captures "<token>.gif" and the suffix is stripped before the lookup.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trackingToken = token.replace(/\.gif$/i, "");

  const supabase = createAdminClient();
  await supabase.rpc("record_campaign_event", {
    p_tracking_token: trackingToken,
    p_event_type: "opened",
    p_metadata: null,
  });

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
