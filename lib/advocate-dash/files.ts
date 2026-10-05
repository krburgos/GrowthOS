/**
 * The two AdvocateDash buckets (client-confirmed, 2026-10-05).
 *
 * Both are private, like workstream-reports and unlike the four image
 * buckets: a drop-by letter names a prospect an MSP is courting and a visit
 * photo is somebody's premises, so a guessable path must be worth nothing
 * to another tenant. Reads go through short-lived signed URLs minted when a
 * modal opens, never stored on the row.
 *
 * Paths put the account first so the storage policy authorises on
 * `storage.foldername(name)[1]` with no table lookup — which also means a
 * path must never be built from user input.
 */

export const LETTERS_BUCKET = "advocate-dash-letters";
export const PHOTOS_BUCKET = "advocate-dash-photos";

/** How long a signed view or download link stays good. */
export const SIGNED_URL_TTL_SECONDS = 300;

/** What the letter input accepts. The client's own template is a Word file,
 *  so .docx is allowed even though only a PDF can render in the modal. */
export const LETTER_ACCEPT =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword";

export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";

/** 10 MB, matching the bucket's own file_size_limit. */
export const MAX_FILE_BYTES = 10_485_760;

const LETTER_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** `<account_id>/<target_id>/<uuid>.<ext>` in the letters bucket. */
export function letterPath(accountId: string, targetId: string, mimeType: string): string {
  const ext = LETTER_EXTENSIONS[mimeType] ?? "pdf";
  return `${accountId}/${targetId}/${crypto.randomUUID()}.${ext}`;
}

/** `<account_id>/<target_id>/<uuid>.<ext>` in the photos bucket. */
export function photoPath(accountId: string, targetId: string, mimeType: string): string {
  const ext = PHOTO_EXTENSIONS[mimeType] ?? "jpg";
  return `${accountId}/${targetId}/${crypto.randomUUID()}.${ext}`;
}

export function isAcceptedLetter(mimeType: string): boolean {
  return mimeType in LETTER_EXTENSIONS;
}

export function isAcceptedPhoto(mimeType: string): boolean {
  return mimeType in PHOTO_EXTENSIONS;
}

/**
 * Whether the modal can show this letter inline. A browser renders a PDF in
 * an iframe and cannot render a .docx at all, so a Word letter is offered
 * as a download instead. Recorded in the migration too, so the behaviour is
 * not mistaken for a bug.
 */
export function isInlineViewable(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

/** "2.4 MB", or nothing when the size was never recorded. */
export function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
