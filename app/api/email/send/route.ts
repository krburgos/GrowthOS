import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { sendWithFallback } from "@/lib/email/resend-send";
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
 * migration). The connection's tokens are never used — sending always
 * goes through Resend, never that identity's actual Gmail/Outlook.
 *
 * Real-address attempt, with a graceful fallback (2026-09-08 follow-up):
 * Resend can send from any address on a domain verified in the account,
 * not just one fixed EMAIL_FROM_ADDRESS — so the first attempt uses the
 * picked identity's (or, by default, the sender's own) real address as
 * From. If that address's domain isn't verified yet, Resend rejects it
 * with a "not verified" error; only then does this retry using the
 * shared EMAIL_FROM_ADDRESS, with the real address kept as Reply-To
 * (which works for any address, verified or not — Reply-To isn't
 * subject to domain authentication the way From is). This is why a
 * teammate's Gmail/Outlook-connected identity still falls back cleanly:
 * their domain can never be verified by this account, but their real
 * address still works fine as Reply-To. Every send is logged as an
 * activities row (send_from_connection_id records which identity was
 * *picked*, not which literal address the send ultimately used — the
 * display name is accurate either way, only the address can differ in
 * the fallback case) and any Cc list.
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

  const { error: sendError } = await sendWithFallback({
    fromName,
    realAddress: replyToEmail,
    replyToEmail,
    to: contact.email,
    cc: ccList,
    subject,
    content: body,
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
