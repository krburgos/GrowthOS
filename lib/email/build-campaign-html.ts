const URL_RE = /https?:\/\/[^\s<]+/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Backend Schema §9 — campaign emails need an open-tracking pixel and
 * click-tracking links, which a plain-text send can't carry. The
 * composer stays plain-text/basic-formatting only (Tech Stack Lockfile
 * §5.3, no rich-text editor), but the *delivered* email is simple HTML:
 * escaped body text with any bare URL rewritten to route through
 * /api/track/click/[token] first, a CAN-SPAM unsubscribe footer
 * (mechanical necessity behind contacts.email_opt_out, Backend Schema
 * §12), and a 1×1 tracking pixel hitting /api/track/open/[token].gif.
 *
 * URL detection runs on the *original* body before HTML-escaping (via
 * split/match on the same regex) rather than escaping first and then
 * matching — escaping first would corrupt "&" inside real URLs before
 * the regex ever saw them.
 */
export function buildCampaignHtml({
  body,
  appUrl,
  trackingToken,
}: {
  body: string;
  appUrl: string;
  trackingToken: string;
}): string {
  const parts = body.split(URL_RE);
  const urls = body.match(URL_RE) ?? [];

  let content = "";
  parts.forEach((part, i) => {
    content += escapeHtml(part).replace(/\n/g, "<br>");
    const url = urls[i];
    if (url) {
      const clickUrl = `${appUrl}/api/track/click/${trackingToken}?url=${encodeURIComponent(url)}`;
      content += `<a href="${escapeHtml(clickUrl)}">${escapeHtml(url)}</a>`;
    }
  });

  const unsubscribeUrl = campaignUnsubscribeUrl(appUrl, trackingToken);
  const pixelUrl = `${appUrl}/api/track/open/${trackingToken}.gif`;

  return [
    `<div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #262e40; line-height: 1.6;">${content}</div>`,
    `<p style="margin-top: 32px; font-size: 12px; color: #9aa4b8;">If you no longer want to receive these emails, <a href="${escapeHtml(unsubscribeUrl)}" style="color: #9aa4b8;">unsubscribe here</a>.</p>`,
    `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:none;" />`,
  ].join("\n");
}

/** The campaign's unsubscribe link, shared by the footer and the List-Unsubscribe header. */
export function campaignUnsubscribeUrl(appUrl: string, trackingToken: string): string {
  return `${appUrl}/api/unsubscribe/${trackingToken}`;
}

/**
 * The plain-text part sent alongside buildCampaignHtml (added 2026-10-26): an
 * HTML-only email is a spam signal. The same body, links through the same
 * click tracking, and the same unsubscribe line.
 */
export function buildCampaignText({
  body,
  appUrl,
  trackingToken,
}: {
  body: string;
  appUrl: string;
  trackingToken: string;
}): string {
  const content = body.replace(URL_RE, (url) => `${appUrl}/api/track/click/${trackingToken}?url=${encodeURIComponent(url)}`);
  return `${content}\n\n--\nIf you no longer want to receive these emails, unsubscribe here: ${campaignUnsubscribeUrl(appUrl, trackingToken)}`;
}
