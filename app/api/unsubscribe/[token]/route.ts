import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backend Schema §9 — GET /api/unsubscribe/[token], public, no session.
 * Records an 'unsubscribed' event (record_campaign_event() also sets
 * contacts.email_opt_out = true as a side effect) and shows a plain
 * confirmation page — a human clicks this link from their own inbox, so
 * this returns real HTML rather than JSON. Always shows the same
 * confirmation regardless of whether the token was valid, matching the
 * app's existing non-revealing pattern (Forgot Password, App Flow §4.1).
 */
function page(message: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unsubscribed — GrowthOS</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8f9fb; font-family: -apple-system, "Segoe UI", sans-serif; color: #262e40; }
  .card { max-width: 420px; margin: 24px; padding: 32px; background: #fff; border: 1px solid #e2e6ed; border-radius: 12px; text-align: center; }
  .icon { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 999px; background: #e5f2f5; display: flex; align-items: center; justify-content: center; }
  h1 { margin: 0 0 8px; font-size: 18px; color: #022a66; }
  p { margin: 0; font-size: 14px; color: #707c93; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#028eab" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
    </div>
    <h1>You're unsubscribed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = createAdminClient();
  await supabase.rpc("record_campaign_event", {
    p_tracking_token: token,
    p_event_type: "unsubscribed",
    p_metadata: null,
  });

  return new NextResponse(page("You won't receive marketing emails from this sender again."), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
