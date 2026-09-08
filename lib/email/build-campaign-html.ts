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

  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${trackingToken}`;
  const pixelUrl = `${appUrl}/api/track/open/${trackingToken}.gif`;

  return [
    `<div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #262e40; line-height: 1.6;">${content}</div>`,
    `<p style="margin-top: 32px; font-size: 12px; color: #9aa4b8;">If you no longer want to receive these emails, <a href="${escapeHtml(unsubscribeUrl)}" style="color: #9aa4b8;">unsubscribe here</a>.</p>`,
    `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:none;" />`,
  ].join("\n");
}
