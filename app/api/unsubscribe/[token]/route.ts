import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backend Schema §9 — /api/unsubscribe/[token], public, no session.
 *
 * GET (the footer link) shows an "Unsubscribe" button rather than
 * unsubscribing (client-confirmed, 2026-10-26): Microsoft 365 Safe Links
 * and other scanners open every link in an email before the reader does,
 * the same thing that used up one-time invites (/auth/confirm), so a GET
 * that unsubscribed would opt out people who never clicked.
 *
 * POST records an 'unsubscribed' event (record_campaign_event() also sets
 * contacts.email_opt_out = true as a side effect). It is what the button
 * submits, and what Gmail's and Yahoo's own Unsubscribe button sends
 * (RFC 8058 one-click, `List-Unsubscribe=One-Click`, from the
 * List-Unsubscribe header every campaign email carries).
 *
 * Both always show the same page whether or not the token was valid,
 * matching the app's non-revealing pattern (Forgot Password, App Flow §4.1).
 */
function page(title: string, body: string) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — GrowthMission</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8f9fb; font-family: -apple-system, "Segoe UI", sans-serif; color: #262e40; }
  .card { max-width: 420px; margin: 24px; padding: 32px; background: #fff; border: 1px solid #e2e6ed; border-radius: 12px; text-align: center; }
  .icon { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 999px; background: #e5f2f5; display: flex; align-items: center; justify-content: center; }
  h1 { margin: 0 0 8px; font-size: 18px; color: #022a66; }
  p { margin: 0; font-size: 14px; color: #707c93; line-height: 1.5; }
  button { margin-top: 20px; height: 40px; padding: 0 20px; border: 0; border-radius: 6px; background: #113c7b; color: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #133972; }
  button:focus-visible { outline: 2px solid #03b8de; outline-offset: 2px; }
</style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET() {
  // The form posts back to this same address.
  return page(
    "Unsubscribe",
    `<h1>Unsubscribe from these emails?</h1>
    <p>You'll stop receiving marketing emails from this sender.</p>
    <form method="post"><button type="submit">Unsubscribe</button></form>`
  );
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();
  await supabase.rpc("record_campaign_event", {
    p_tracking_token: token,
    p_event_type: "unsubscribed",
    p_metadata: null,
  });

  return page(
    "Unsubscribed",
    `<div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#028eab" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
    </div>
    <h1>You're unsubscribed</h1>
    <p>You won't receive marketing emails from this sender again.</p>`
  );
}
