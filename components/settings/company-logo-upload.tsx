"use client";

import { Building2, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, matches the storage bucket's file_size_limit

/**
 * Client-confirmed reversal of the earlier "logo is a pasted URL, not a
 * file upload" decision — Backend Schema §12 keeps file attachments out
 * of Phase 1 scope generally, but this is a direct, explicit request to
 * reopen that line for the company logo specifically. Uploads to the
 * "company-logos" storage bucket (public read, write restricted to
 * Owner/Admin/CRO Admin/CRO Advisor for their own account — see the
 * company_logo_storage migration) and writes the resulting public URL
 * straight into accounts.logo_url.
 */
export function CompanyLogoUpload({
  accountId,
  logoUrl,
  canEdit,
}: {
  accountId: string;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(logoUrl);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPG, WebP, or SVG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be 2MB or smaller.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop();
    const path = `${accountId}/logo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploading(false);
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    // Cache-bust so an upsert with the same filename shows immediately.
    const url = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("accounts").update({ logo_url: url }).eq("id", accountId);
    setUploading(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setPreview(url);
    toast.success("Logo updated.");
    router.refresh();
  };

  return (
    <div className="relative flex size-full items-center justify-center">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <Building2 className="size-7 text-neutral-400" />
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
            aria-label="Upload company logo"
            className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary-700 text-white shadow-sm hover:bg-primary-800 disabled:opacity-50"
          >
            <Camera className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
