import { Resend } from "resend";

/**
 * Shared by the Contact Detail quick-send route (app/api/email/send) and
 * Campaigns' send-due route (app/api/campaigns/send-due) — both need the
 * exact same real-address-with-fallback behavior (Tech Stack Lockfile
 * §5.2): try the picked identity's real address as From first, and only
 * fall back to the shared EMAIL_FROM_ADDRESS if Resend rejects it for an
 * unverified domain, keeping the real address as Reply-To either way.
 */
export interface SendWithFallbackParams {
  fromName: string;
  /** The picked identity's own address (or, for a default send, the sender's own). */
  realAddress: string;
  replyToEmail: string;
  to: string;
  cc?: string[];
  subject: string;
  content: string;
  isHtml?: boolean;
  tags?: { name: string; value: string }[];
}

export async function sendWithFallback(
  params: SendWithFallbackParams
): Promise<{ error: { message?: string } | null }> {
  const { RESEND_API_KEY, EMAIL_FROM_ADDRESS } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM_ADDRESS) {
    return { error: { message: "Email sending isn't configured yet — ask an admin to set up Resend." } };
  }

  const resend = new Resend(RESEND_API_KEY);
  const attempt = (address: string) =>
    resend.emails.send({
      from: `${params.fromName} <${address}>`,
      replyTo: params.replyToEmail,
      to: params.to,
      cc: params.cc && params.cc.length > 0 ? params.cc : undefined,
      subject: params.subject,
      tags: params.tags,
      ...(params.isHtml ? { html: params.content } : { text: params.content }),
    });

  let { error } = await attempt(params.realAddress);

  if (error && params.realAddress !== EMAIL_FROM_ADDRESS && /not verified/i.test(error.message ?? "")) {
    ({ error } = await attempt(EMAIL_FROM_ADDRESS));
  }

  return { error };
}
