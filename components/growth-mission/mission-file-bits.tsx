"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { FILES_BUCKET, fileKind, type FileKind, type MissionFile } from "@/lib/growth-mission/files";
import { SIGNED_URL_TTL_SECONDS, formatFileSize, formatReportDate } from "@/lib/growth-mission/reports";
import { createClient } from "@/lib/supabase/client";

/**
 * Pieces the Arsenal and the order panel share (client-confirmed,
 * 2026-10-20, approved mockup "The Arsenal"). The viewer is the Status
 * Report's (report-panel.tsx), so a file opens the way a report does.
 */

const KIND_CHIP: Record<FileKind, string> = {
  pdf: "bg-error-100 text-error-700",
  ppt: "bg-warning-100 text-warning-800",
  doc: "bg-primary-100 text-primary-700",
  xls: "bg-success-100 text-success-700",
  csv: "bg-success-100 text-success-700",
  img: "bg-secondary-100 text-secondary-800",
  file: "bg-neutral-100 text-neutral-600",
};

export function KindChip({ name }: { name: string }) {
  const kind = fileKind(name);
  return (
    <span
      className={`inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 text-caption font-bold uppercase ${KIND_CHIP[kind]}`}
    >
      {kind === "file" ? "File" : kind}
    </span>
  );
}

export function fileMeta(file: MissionFile): string {
  return [formatFileSize(file.file_size), file.uploadedBy, formatReportDate(file.created_at)].filter(Boolean).join(" · ");
}

export async function downloadFile(file: MissionFile) {
  const { data, error } = await createClient()
    .storage.from(FILES_BUCKET)
    .createSignedUrl(file.file_path, SIGNED_URL_TTL_SECONDS, { download: file.file_name });
  if (error || !data) {
    toast.error(getFriendlyErrorMessage(error));
    return;
  }
  window.location.href = data.signedUrl;
}

/** PDFs and images in the Status Report's viewer; the signed URL lives only as long as the dialog. */
export function FileViewer({ file, onClose }: { file: MissionFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isImage = fileKind(file.file_name) === "img";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient()
        .storage.from(FILES_BUCKET)
        .createSignedUrl(file.file_path, SIGNED_URL_TTL_SECONDS);
      if (cancelled) return;
      if (error || !data) setFailed(true);
      else setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [file.file_path]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-body font-semibold text-primary-900">{file.file_name}</DialogTitle>
            <p className="text-caption text-neutral-500">{fileMeta(file)}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void downloadFile(file)}>
            <Download className="mr-1.5 size-4" />
            Download
          </Button>
        </DialogHeader>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-200">
          {failed ? (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-600">
              That file could not be opened. It may have been removed.
            </p>
          ) : url ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={file.file_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <iframe src={`${url}#view=Fit&zoom=page-fit&navpanes=0`} title={file.file_name} className="size-full border-0" />
            )
          ) : (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-500">Opening…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
