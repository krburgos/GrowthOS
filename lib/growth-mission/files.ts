import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Arsenal (client-confirmed, 2026-10-20, approved mockup "The Arsenal"):
 * a file library on each Mission Card. A file belongs to the Mission Card in
 * general (task_id null) or to one of its Mission Orders.
 *
 * Like the Status Report, the bucket is private: a client's working files,
 * read through short-lived signed URLs, under paths namespaced by account so
 * the storage policy authorises without a table lookup
 * (20261020000001_arsenal_files.sql).
 */

export const FILES_BUCKET = "mission-files";

/** Matches the bucket's file_size_limit, so the app refuses before storage does. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Matches the bucket's allowed_mime_types. */
export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  csv: "text/csv",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** For the file picker's accept attribute. */
export const ACCEPT = Object.keys(ALLOWED_TYPES).map((e) => `.${e}`).join(",");

export interface MissionFile {
  id: string;
  step_slug: string;
  task_id: string | null;
  /** The order's title, when the file belongs to one. */
  taskTitle: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
  uploadedBy: string | null;
}

export type FileKind = "pdf" | "doc" | "xls" | "ppt" | "img" | "csv" | "file";

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function fileKind(name: string): FileKind {
  const ext = extension(name);
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx" || ext === "txt") return "doc";
  if (ext === "xls" || ext === "xlsx") return "xls";
  if (ext === "ppt" || ext === "pptx") return "ppt";
  if (ext === "csv") return "csv";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "img";
  return "file";
}

/** PDFs and images open in the viewer; everything else downloads. */
export function canPreview(name: string): boolean {
  const k = fileKind(name);
  return k === "pdf" || k === "img";
}

/** Why a file can't be uploaded, or null when it can. */
export function rejectReason(file: File): string | null {
  if (!ALLOWED_TYPES[extension(file.name)]) {
    return `${file.name} isn't a type the Arsenal takes. Use PDF, Word, Excel, PowerPoint, an image or CSV.`;
  }
  if (file.size > MAX_FILE_BYTES) return `${file.name} is over 25 MB.`;
  return null;
}

/**
 * Upload one file and record it. The object goes first and the row second,
 * and a failed row removes the object, so no row ever points at nothing.
 * The first path segment is the tenant, which the storage policy checks.
 */
export async function uploadMissionFile(
  supabase: SupabaseClient,
  { accountId, slug, taskId, file }: { accountId: string; slug: string; taskId: string | null; file: File }
): Promise<{ error: string | null }> {
  const reason = rejectReason(file);
  if (reason) return { error: reason };

  const contentType = ALLOWED_TYPES[extension(file.name)];
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const path = `${accountId}/${slug}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType });
  if (uploadError) return { error: `Couldn't upload ${file.name}. Check your connection and try again.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: rowError } = await supabase.from("growth_mission_files").insert({
    account_id: accountId,
    step_slug: slug,
    task_id: taskId,
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    content_type: contentType,
    uploaded_by: user?.id ?? null,
  });
  if (rowError) {
    await supabase.storage.from(FILES_BUCKET).remove([path]);
    return { error: rowError.message };
  }
  return { error: null };
}
