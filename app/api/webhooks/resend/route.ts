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
 *
 * Client-confirmed (2026-10-22): a bounce is also stamped on the contact
 * (contacts.email_bounced_at), for a campaign send (found through its
 * token) and for a 1-1 email from Contact Detail (its `contact_id` tag).
 * A temporary bounce (mailbox full, server busy) is not stamped: only a
 * lasting one says the address is bad.
 */
const HANDLED_EVENTS: Record<string, "bounced" | "complained" | "delivered"> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  let event: {
    type?: string;
    created_at?: string;
    data?: { tags?: { name: string; value: string }[] | Record<string, string>; bounce?: { type?: string } };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType = event.type ? HANDLED_EVENTS[event.type] : undefined;
  if (!eventType) {
    return NextResponse.json({ ok: true });
  }

  // Resend has sent tags both as a list of {name, value} and as an object.
  const rawTags = event.data?.tags;
  const tag = (name: string) =>
    Array.isArray(rawTags) ? rawTags.find((t) => t.name === name)?.value : rawTags?.[name];
  const trackingToken = tag("tracking_token");
  const taggedContactId = tag("contact_id");

  const supabase = createAdminClient();

  if (trackingToken) {
    await supabase.rpc("record_campaign_event", {
      p_tracking_token: trackingToken,
      p_event_type: eventType,
      p_metadata: null,
    });
  }

  const lasting = !/transient/i.test(event.data?.bounce?.type ?? "");
  if (eventType === "bounced" && lasting) {
    let contactId = taggedContactId && UUID.test(taggedContactId) ? taggedContactId : null;
    if (!contactId && trackingToken && UUID.test(trackingToken)) {
      const { data } = await supabase
        .from("campaign_recipients")
        .select("contact_id")
        .eq("tracking_token", trackingToken)
        .maybeSingle();
      contactId = data?.contact_id ?? null;
    }
    if (contactId) {
      await supabase
        .from("contacts")
        .update({ email_bounced_at: event.created_at ?? new Date().toISOString() })
        .eq("id", contactId);
    }
  }

  return NextResponse.json({ ok: true });
}
