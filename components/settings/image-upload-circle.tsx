"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
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
  shape = "circle",
  variant = "default",
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
  /**
   * "tile" (2026-09-22) renders a rounded square that fits the whole
   * image in rather than a circle that crops to fill. A person's face
   * survives a circular crop; a company wordmark does not — CRO Leader's
   * own logo is roughly 4:1, so object-cover in a circle showed a slice
   * of the middle and nothing else. Avatars keep the circle.
   */
  shape?: "circle" | "tile";
  /**
   * "hero" (client-confirmed, 2026-10-14, "Contact Photo" option A) is for
   * an avatar on the navy hero: a small cyan camera badge on the edge,
   * which works on touch screens, plus "Add photo" / "Change photo" across
   * the circle on hover or keyboard focus. The default 36px button covered
   * half of a 72-80px circle.
   */
  variant?: "default" | "hero";
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
      // Storage errors are technical; say what to do instead.
      toast.error("Couldn't upload that image. Check your connection and try again.");
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    // Cache-bust so an upsert with the same filename shows immediately.
    const url = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from(table).update({ [urlColumn]: url }).eq(idColumn, idValue);
    setUploading(false);

    if (updateError) {
      toast.error(getFriendlyErrorMessage(updateError));
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
        <img
          src={preview}
          alt=""
          className={cn("size-full", shape === "tile" ? "rounded-md object-contain" : "rounded-full object-cover")}
        />
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
          {variant === "hero" && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label={preview ? "Change photo" : "Add photo"}
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-primary-950/60 text-caption font-semibold text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-wait motion-reduce:transition-none"
            >
              <Camera className="size-[18px]" />
              {uploading ? "Uploading…" : preview ? "Change photo" : "Add photo"}
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={ariaLabel}
            tabIndex={variant === "hero" ? -1 : undefined}
            className={cn(
              "absolute flex items-center justify-center rounded-full shadow-sm disabled:opacity-50",
              variant === "hero"
                ? "-bottom-0.5 -right-0.5 size-7 bg-secondary-500 text-primary-950 ring-[3px] ring-primary-800 hover:bg-secondary-400"
                : "bg-primary-700 text-white ring-2 ring-white hover:bg-primary-800",
              variant !== "hero" && (compact ? "size-5" : "size-9"),
              // A tile has corners, so the button hangs off one instead of
              // sitting inside the image and covering part of it.
              variant !== "hero" && (shape === "tile" ? "-bottom-1.5 -right-1.5" : "bottom-0 right-0")
            )}
          >
            <Camera className={variant === "hero" ? "size-3.5" : compact ? "size-3" : "size-5"} />
          </button>
        </>
      )}
    </div>
  );
}
