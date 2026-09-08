import nodemailer from "nodemailer";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Client-confirmed addition (2026-09-08) — a single-contact "quick send"
 * from Contact Detail, ahead of Milestone 10's bulk Campaigns. The docs
 * were silent on this narrower case; the client's explicit direction was
 * to use the same mechanism Campaigns will use rather than sending via
 * the recipient's own connected Gmail/M365 mailbox (Tech Stack Lockfile
 * §5.2 reserves provider send APIs for nothing — "don't implement
 * Gmail/Graph send APIs" — regardless of which mailbox is connected).
 *
 * The connected email_connections identity isn't used for sending at
 * all here (per §6.3 it's single-user and only verifies identity); the
 * sender's real address is only used as the Reply-To so replies still
 * reach them even though delivery routes through the shared relay.
 */
const sendEmailSchema = z.object({
  contactId: z.string().uuid(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

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
  const { contactId, subject, body } = parsed.data;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("id", contactId)
    .is("archived_at", null)
    .single();

  if (!contact) {
    return NextResponse.json({ error: "That contact couldn't be found." }, { status: 404 });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM_ADDRESS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM_ADDRESS) {
    return NextResponse.json(
      { error: "Email sending isn't configured yet — ask an admin to set up the mail relay." },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"${sender.full_name} via GrowthOS" <${EMAIL_FROM_ADDRESS}>`,
      replyTo: sender.email,
      to: contact.email,
      subject,
      text: body,
    });
  } catch {
    return NextResponse.json({ error: "Couldn't send that email — please try again." }, { status: 502 });
  }

  const { error: activityError } = await supabase.from("activities").insert({
    account_id: sender.account_id,
    contact_id: contact.id,
    user_id: sender.id,
    type: "email",
    subject,
    body,
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
