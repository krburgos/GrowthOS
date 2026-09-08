import { NextResponse, type NextRequest } from "next/server";

import { verifySvixSignature } from "@/lib/email/verify-svix-signature";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backend Schema §9 — bounces and complaints can't be detected from a
 * pixel or redirect, so they come from Resend's own (Svix-signed)
 * webhook instead. Opens/clicks are handled by this app's own
 * /api/track routes, not this webhook, so only bounced/complained/
 * delivered events are forwarded to record_campaign_event() — matching
 * exactly what this section already documents this route as doing.
 *
 * The recipient is identified via the `tracking_token` tag set on every
 * campaign send (lib/campaigns/build-send-plan.ts), echoed back by
 * Resend in `data.tags` — not by matching on to-address, which could
 * collide across campaigns/contacts.
 */
const HANDLED_EVENTS: Record<string, "bounced" | "complained" | "delivered"> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
};

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  const valid = verifySvixSignature({ payload, svixId, svixTimestamp, svixSignature, secret });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { tags?: { name: string; value: string }[] } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType = event.type ? HANDLED_EVENTS[event.type] : undefined;
  if (!eventType) {
    return NextResponse.json({ ok: true });
  }

  const trackingToken = event.data?.tags?.find((t) => t.name === "tracking_token")?.value;
  if (!trackingToken) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  await supabase.rpc("record_campaign_event", {
    p_tracking_token: trackingToken,
    p_event_type: eventType,
    p_metadata: null,
  });

  return NextResponse.json({ ok: true });
}
