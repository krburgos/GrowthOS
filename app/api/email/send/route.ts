import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Client-confirmed addition (2026-09-08) — a single-contact "quick send"
 * from Contact Detail, ahead of Milestone 10's bulk Campaigns. Sends via
 * Resend (Tech Stack Lockfile §5.2, amended from SendGrid/Nodemailer the
 * same day) rather than the recipient's own connected Gmail/M365 mailbox
 * — Tech Stack Lockfile §5.2 still says "don't implement Gmail/Graph
 * send APIs," regardless of which mailbox is connected.
 *
 * From/Cc (same-day follow-up): `fromConnectionId` optionally picks any
 * *account-wide* connected mailbox's identity (client-confirmed
 * reversal of part of Backend Schema §6.3's single-user rule, scoped to
 * this narrow read — see the email_connections_directory_and_send_from
 * migration). This is cosmetic only: the connection's tokens are never
 * used, and the email still goes out through Resend with that
 * identity's name/address as the display From and Reply-To. Every send
 * is logged as an activities row, including which identity was used
 * (send_from_connection_id, null = the sender's own) and any Cc list.
 */
const sendEmailSchema = z.object({
  contactId: z.string().uuid(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  fromConnectionId: z.string().uuid().nullable().optional(),
  cc: z.string().optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAddressList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sender } = await supabase
    .from("users")
    .select("id, account_id, full_name, email")
    .eq("id", authUser.id)
    .single();

  if (!sender) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = sendEmailSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a subject and a message." }, { status: 400 });
  }
  const { contactId, subject, body, fromConnectionId, cc } = parsed.data;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("id", contactId)
    .is("archived_at", null)
    .single();

  if (!contact) {
    return NextResponse.json({ error: "That contact couldn't be found." }, { status: 404 });
  }

  const ccList = parseAddressList(cc);
  const invalidCc = ccList.find((addr) => !EMAIL_RE.test(addr));
  if (invalidCc) {
    return NextResponse.json({ error: `"${invalidCc}" isn't a valid email address.` }, { status: 400 });
  }

  let fromName = sender.full_name;
  let replyToEmail = sender.email;

  if (fromConnectionId) {
    const { data: connection } = await supabase
      .from("email_connections")
      .select("id, email_address, status, users(full_name, account_id)")
      .eq("id", fromConnectionId)
      .single();

    const owner = connection ? (Array.isArray(connection.users) ? connection.users[0] : connection.users) : undefined;
    if (!connection || connection.status !== "connected" || !owner || owner.account_id !== sender.account_id) {
      return NextResponse.json({ error: "That sender identity isn't available." }, { status: 400 });
    }

    fromName = owner.full_name;
    replyToEmail = connection.email_address;
  }

  const { RESEND_API_KEY, EMAIL_FROM_ADDRESS } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM_ADDRESS) {
    return NextResponse.json(
      { error: "Email sending isn't configured yet — ask an admin to set up Resend." },
      { status: 500 }
    );
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: `${fromName} <${EMAIL_FROM_ADDRESS}>`,
    replyTo: replyToEmail,
    to: contact.email,
    cc: ccList.length > 0 ? ccList : undefined,
    subject,
    text: body,
  });

  if (sendError) {
    console.error("Resend send failed:", sendError);
    return NextResponse.json(
      { error: `Couldn't send that email — ${sendError.message || "please try again."}` },
      { status: 502 }
    );
  }

  const { error: activityError } = await supabase.from("activities").insert({
    account_id: sender.account_id,
    contact_id: contact.id,
    user_id: sender.id,
    type: "email",
    subject,
    body,
    cc: ccList.length > 0 ? ccList.join(", ") : null,
    send_from_connection_id: fromConnectionId ?? null,
  });

  if (activityError) {
    // The email itself already sent; only the activity log failed. Surface
    // it distinctly rather than implying the send failed too.
    return NextResponse.json(
      { error: "Email sent, but logging it to the contact's activity failed." },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true });
}
