/**
 * Workstream reports (client-confirmed, 2026-10-02).
 *
 * CRO Leader uploads a PDF per workstream — the SEO analytics, the GEO
 * citation report, and so on. The MSP opens it in a modal on the workstream
 * page and may download it. Every past report is kept: replacing one
 * archives the previous rather than overwriting it.
 *
 * This replaces the typed Status Report panel on the workstream page. The
 * typed summary and its figures were CRO-authored prose about where the
 * workstream stood; the client would rather hand over the real report.
 *
 * The bucket is PRIVATE, unlike the four image buckets this schema already
 * has. Those hold logos and avatars meant to be fetched by URL; these are a
 * client's own analytics, so reads go through a short-lived signed URL and
 * a guessable path is worth nothing to another tenant.
 */

export const REPORTS_BUCKET = "workstream-reports";

/** How long a signed view or download link stays good. */
export const SIGNED_URL_TTL_SECONDS = 300;

export interface WorkstreamReport {
  id: string;
  title: string;
  /** Object path inside the bucket: <account_id>/<step_slug>/<uuid>.pdf */
  file_path: string;
  file_size: number | null;
  created_at: string;
  uploadedBy: string | null;
}

/**
 * Where an upload lands. The first segment is the tenant, which is what the
 * storage policy checks — so the path is the authorisation boundary and
 * must never be built from user input.
 */
export function reportPath(accountId: string, slug: string, fileName: string): string {
  const ext = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
  return `${accountId}/${slug}/${crypto.randomUUID()}.${ext}`;
}

/** "2.4 MB", or nothing when the size was never recorded. */
export function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "28 Sep 2026" — the date a reader cares about, not a timestamp. */
export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A default title for an upload, so CRO Leader need not type one. */
export function defaultReportTitle(stepTitle: string, now = new Date()): string {
  const month = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `${stepTitle.split("—")[0].trim()} report — ${month}`;
}
