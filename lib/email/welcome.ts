/**
 * The welcome email (client-confirmed, 2026-11-02, approved mockup
 * "Welcome Email CC"): a short note with a Set your password button for a
 * client user who has never logged in. Email-safe inline styles; the
 * colours are Design System §9's primary-700, secondary-500 and primary-900.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface WelcomeEmail {
  firstName: string;
  accountName: string;
  link: string;
  /** Adds the line pointing to their SniperLeads opportunities. */
  sniperLeads: boolean;
}

export function welcomeSubject(w: WelcomeEmail): string {
  return `Welcome to GrowthMission, ${w.firstName}`;
}

export function welcomeHtml(w: WelcomeEmail): string {
  const p = 'style="margin:0 0 16px;"';
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#ffffff;">
<div style="max-width:560px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">
<div style="font-size:20px;font-weight:bold;margin:0 0 20px;"><span style="color:#113c7b;">Growth</span><span style="color:#03b8de;">Mission</span></div>
<p ${p}>Hi ${esc(w.firstName)},</p>
<p ${p}>Your GrowthMission account for <b>${esc(w.accountName)}</b> is ready. It brings your${w.sniperLeads ? " SniperLeads" : ""} opportunities, contacts and pipeline into one place.</p>
<p ${p}>Click below to choose your password and sign in.</p>
<p ${p}><a href="${esc(w.link)}" style="display:inline-block;background:#022a66;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:6px;">Set your password</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#64748b;">This link works once and expires in 1 hour. If it has expired, go to www.growthmission.app and click <b>Forgot password?</b></p>
${w.sniperLeads ? `<p ${p}>Once you're in, your SniperLeads opportunities are under <b>Opportunities</b>.</p>` : ""}
<p ${p}>Questions? Just reply to this email.<br>The CRO Leader team</p>
</div></body></html>`;
}

export function welcomeText(w: WelcomeEmail): string {
  return [
    `Hi ${w.firstName},`,
    `Your GrowthMission account for ${w.accountName} is ready. It brings your${w.sniperLeads ? " SniperLeads" : ""} opportunities, contacts and pipeline into one place.`,
    `Choose your password and sign in here:\n${w.link}`,
    "This link works once and expires in 1 hour. If it has expired, go to www.growthmission.app and click Forgot password?",
    ...(w.sniperLeads ? ["Once you're in, your SniperLeads opportunities are under Opportunities."] : []),
    "Questions? Just reply to this email.\nThe CRO Leader team",
  ].join("\n\n");
}
