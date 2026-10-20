/**
 * Fill-in fields for 1-1 emails and templates (client-confirmed,
 * 2026-10-20). A field is stored as a text token — "{First name}" — in the
 * subject, and as a chip in the editor's HTML:
 * <span data-merge-field="first_name">{First name}</span>. Both forms are
 * filled in when the email is sent, so a template reads the same in the
 * editor, in Settings and in the database.
 */

export const MERGE_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "full_name", label: "Full name" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "sender_name", label: "Your name" },
] as const;

export type MergeKey = (typeof MERGE_FIELDS)[number]["key"];
export type MergeValues = Partial<Record<MergeKey, string | null>>;

const LABEL_TO_KEY = new Map<string, MergeKey>(MERGE_FIELDS.map((f) => [f.label.toLowerCase(), f.key]));

/** A missing value falls back to something that still reads well. */
const FALLBACK: Record<MergeKey, string> = {
  first_name: "there",
  last_name: "",
  full_name: "there",
  company: "your company",
  title: "",
  sender_name: "",
};

function valueFor(key: MergeKey, values: MergeValues): string {
  const v = values[key]?.trim();
  return v ? v : FALLBACK[key];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fill the "{First name}" tokens in a plain-text subject. */
export function fillText(text: string, values: MergeValues): string {
  return text.replace(/\{([A-Za-z ]+)\}/g, (match, label: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    return key ? valueFor(key, values) : match;
  });
}

/** Fill the chips and any bare tokens in the email's HTML, escaping the values. */
export function fillHtml(html: string, values: MergeValues): string {
  const chips = html.replace(
    /<span[^>]*data-merge-field="([a-z_]+)"[^>]*>[\s\S]*?<\/span>/g,
    (match, key: string) => (MERGE_FIELDS.some((f) => f.key === key) ? escapeHtml(valueFor(key as MergeKey, values)) : match)
  );
  return chips.replace(/\{([A-Za-z ]+)\}/g, (match, label: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    return key ? escapeHtml(valueFor(key, values)) : match;
  });
}

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "span", "blockquote", "h1", "h2", "h3", "hr"]);

/**
 * Keep only the formatting the editor can produce. The editor already
 * limits its output to this, but the server never trusts the browser:
 * scripts, styles, event handlers and any tag outside the list are
 * dropped, and a link keeps only an http(s) or mailto address.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      if (match.startsWith("</")) return `</${t}>`;
      if (t === "a") {
        const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? "";
        const safe = /^(https?:|mailto:)/i.test(href.trim()) ? href.replace(/"/g, "&quot;") : "";
        return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">` : "<a>";
      }
      if (t === "span") {
        const field = attrs.match(/data-merge-field="([a-z_]+)"/)?.[1];
        return field ? `<span data-merge-field="${field}">` : "<span>";
      }
      return `<${t}>`;
    });
}

/** A plain-text copy, for the email's text part and the contact's activity log. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) =>
      text.replace(/<[^>]+>/g, "") === href ? href : `${text} (${href})`
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the editor holds nothing but empty paragraphs. */
export function isEmptyHtml(html: string): boolean {
  return htmlToText(html).length === 0;
}
