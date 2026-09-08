import { NextResponse, type NextRequest } from "next/server";

import { buildCampaignHtml } from "@/lib/email/build-campaign-html";
import { sendWithFallback } from "@/lib/email/resend-send";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Backend Schema §8, steps 4–6 — POST /api/campaigns/send-due. Called
 * only by Postgres's send_due_campaigns() (via pg_cron + pg_net,
 * already scheduled every minute as of this migration pass — see
 * supabase/migrations for the cron.job/vault.secrets setup that
 * predates this route) with an x-cron-secret header, never by a user
 * session — so this uses the service-role client throughout.
 *
 * Resolves the target list into contacts (excluding email_opt_out),
 * creates any missing campaign_recipients rows, sends each recipient
 * their own email via Resend (lib/email/resend-send's real-address-
 * with-fallback, same as the Contact Detail quick-send route) with a
 * personalized tracking_token baked into the body's open pixel/click
 * links (lib/email/build-campaign-html) and echoed back as a Resend
 * `tag` so the bounce/complaint webhook (app/api/webhooks/resend) can
 * identify which recipient an event belongs to. Concurrency is a flat
 * Promise.allSettled over the whole batch — fine at Phase 1 scale
 * (dozens to a few hundred recipients); a genuinely large list would
 * need real batching/queueing, which is out of scope here.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaign_id: campaignId } = await request.json().catch(() => ({ campaign_id: null }));
  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, account_id, list_id, subject, body, send_from_connection_id, created_by, users!created_by(full_name, email)")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  try {
    let fromName = "GrowthOS";
    let realAddress = process.env.EMAIL_FROM_ADDRESS ?? "";
    let replyToEmail = realAddress;

    const creator = Array.isArray(campaign.users) ? campaign.users[0] : campaign.users;
    if (creator) {
      fromName = creator.full_name;
      replyToEmail = creator.email;
      realAddress = creator.email;
    }

    if (campaign.send_from_connection_id) {
      const { data: connection } = await supabase
        .from("email_connections")
        .select("email_address, users(full_name)")
        .eq("id", campaign.send_from_connection_id)
        .single();
      const owner = connection ? (Array.isArray(connection.users) ? connection.users[0] : connection.users) : undefined;
      if (connection && owner) {
        fromName = owner.full_name;
        replyToEmail = connection.email_address;
        realAddress = connection.email_address;
      }
    }

    const { data: memberRows } = await supabase
      .from("list_members")
      .select("contact_id, contacts!inner(id, email, full_name, email_opt_out, archived_at)")
      .eq("list_id", campaign.list_id);

    const eligibleContacts = (memberRows ?? [])
      .map((row) => (Array.isArray(row.contacts) ? row.contacts[0] : row.contacts))
      .filter((c): c is { id: string; email: string; full_name: string; email_opt_out: boolean; archived_at: string | null } => !!c)
      .filter((c) => !c.archived_at && !c.email_opt_out);

    const { data: existingRecipients } = await supabase
      .from("campaign_recipients")
      .select("id, contact_id, tracking_token, status")
      .eq("campaign_id", campaignId);

    const existingByContact = new Map((existingRecipients ?? []).map((r) => [r.contact_id, r]));
    const toInsert = eligibleContacts
      .filter((c) => !existingByContact.has(c.id))
      .map((c) => ({ campaign_id: campaignId, contact_id: c.id }));

    if (toInsert.length > 0) {
      await supabase.from("campaign_recipients").insert(toInsert);
    }

    const { data: allRecipients } = await supabase
      .from("campaign_recipients")
      .select("id, tracking_token, status, contacts(email)")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    const appUrl = process.env.APP_URL ?? "";

    await Promise.allSettled(
      (allRecipients ?? []).map(async (recipient) => {
        const contact = Array.isArray(recipient.contacts) ? recipient.contacts[0] : recipient.contacts;
        if (!contact) return;

        const html = buildCampaignHtml({ body: campaign.body, appUrl, trackingToken: recipient.tracking_token });

        const { error } = await sendWithFallback({
          fromName,
          realAddress,
          replyToEmail,
          to: contact.email,
          subject: campaign.subject,
          content: html,
          isHtml: true,
          tags: [{ name: "tracking_token", value: recipient.tracking_token }],
        });

        if (error) {
          await supabase.from("campaign_recipients").update({ status: "failed" }).eq("id", recipient.id);
        } else {
          await supabase.rpc("record_campaign_event", {
            p_tracking_token: recipient.tracking_token,
            p_event_type: "sent",
            p_metadata: null,
          });
        }
      })
    );

    await supabase.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaignId);
  } catch (err) {
    console.error("Campaign send failed:", err);
    await supabase.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
