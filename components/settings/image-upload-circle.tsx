"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, matches each storage bucket's file_size_limit

/**
 * Shared upload behavior behind both CompanyLogoUpload and
 * ProfileAvatarUpload — same bucket/table/column shape, just pointed at
 * a different row. Uploads to `${folder}/avatar.<ext>` in `bucket`
 * (upsert, so re-uploading replaces the previous file), then writes the
 * resulting public URL into `table.urlColumn` for the row matching
 * `idColumn = idValue`.
 */
export function ImageUploadCircle({
  bucket,
  folder,
  table,
  idColumn,
  idValue,
  urlColumn,
  currentUrl,
  canEdit,
  fallback,
  ariaLabel,
  compact,
}: {
  bucket: string;
  folder: string;
  table: string;
  idColumn: string;
  idValue: string;
  urlColumn: string;
  currentUrl: string | null;
  canEdit: boolean;
  fallback: ReactNode;
  ariaLabel: string;
  /** Shrinks the camera button for smaller circles (Concept B's 56px
   * compact profile header) — the default size-9 button was sized for
   * the 96-128px circles elsewhere and would swallow a 56px one. */
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPG, WebP, or SVG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop();
    const path = `${folder}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploading(false);
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    // Cache-bust so an upsert with the same filename shows immediately.
    const url = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from(table).update({ [urlColumn]: url }).eq(idColumn, idValue);
    setUploading(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setPreview(url);
    toast.success("Image updated.");
    router.refresh();
  };

  return (
    <div className="relative flex size-full items-center justify-center">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-full rounded-full object-cover" />
      ) : (
        fallback
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={ariaLabel}
            className={cn(
              "absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-primary-700 text-white shadow-sm hover:bg-primary-800 disabled:opacity-50",
              compact ? "size-5" : "size-9"
            )}
          >
            <Camera className={compact ? "size-3" : "size-5"} />
          </button>
        </>
      )}
    </div>
  );
}
