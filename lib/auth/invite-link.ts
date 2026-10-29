/**
 * How long an emailed invite link works. Supabase sets this as Auth →
 * Providers → Email → "Email OTP Expiration"; keep the two the same.
 * Resend invite (client-confirmed, 2026-10-29) only opens once a link has
 * run out, so a value longer than Supabase's only delays it.
 */
export const INVITE_LINK_HOURS = 1;

export interface InviteState {
  last_sign_in_at: string | null;
  invite_sent_at: string | null;
  email_confirmed_at: string | null;
}

/**
 * When the pending invite's link stops working, or null when there is no
 * pending invite (they accepted, signed in, or were never invited).
 */
export function inviteExpiresAt(u: InviteState): Date | null {
  if (u.last_sign_in_at || u.email_confirmed_at || !u.invite_sent_at) return null;
  return new Date(new Date(u.invite_sent_at).getTime() + INVITE_LINK_HOURS * 3_600_000);
}
