"use client";

import { Download, FileText, History, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  REPORTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  defaultReportTitle,
  formatFileSize,
  formatReportDate,
  reportPath,
  type WorkstreamReport,
} from "@/lib/gos-dashboard/reports";
import { createClient } from "@/lib/supabase/client";

/**
 * The workstream's report (client-confirmed, 2026-10-02).
 *
 * This replaced the typed Status Report panel. The client would rather hand
 * over the real analytics PDF than have CRO Leader retype its findings, and
 * collapsing a tall panel into one row is what puts "What to do next"
 * directly under the hours — which was the point of the change.
 *
 * Reads go through a short-lived signed URL rather than a public URL: the
 * bucket holds a client's own analytics, so a guessable path must be worth
 * nothing to another tenant. The URL is minted when the modal opens and is
 * not stored.
 *
 * History is kept (client-confirmed). Uploading does not overwrite — the
 * previous report is archived and stays readable under "Earlier reports".
 */
export function ReportPanel({
  accountId,
  slug,
  stepTitle,
  reports,
  canUpload,
}: {
  accountId: string;
  slug: string;
  stepTitle: string;
  reports: WorkstreamReport[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<WorkstreamReport | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const latest = reports[0] ?? null;
  const earlier = reports.slice(1);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Reports must be a PDF.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = reportPath(accountId, slug, file.name);

    const { error: uploadError } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(path, file, { contentType: "application/pdf" });
    if (uploadError) {
      setBusy(false);
      toast.error(getFriendlyErrorMessage(uploadError));
      return;
    }

    // The row is what the app reads; the object is just bytes. Insert it
    // second so a failed upload never leaves a row pointing at nothing.
    const { error: rowError } = await supabase.from("gos_dashboard_reports").insert({
      account_id: accountId,
      step_slug: slug,
      title: defaultReportTitle(stepTitle),
      file_path: path,
      file_size: file.size,
    });

    setBusy(false);
    if (rowError) {
      // Leave no orphan object behind if the row could not be written.
      await supabase.storage.from(REPORTS_BUCKET).remove([path]);
      toast.error(getFriendlyErrorMessage(rowError));
      return;
    }
    toast.success("Report uploaded.");
    router.refresh();
  };

  return (
    <>
      {/* Inline, not a card (client-confirmed, 2026-10-02). A full-width
          panel spent a whole row of the page on one filename; here the
          report rides the hours header, and the page gets that row back
          for the task sheet. */}
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
          <FileText className="size-4" />
        </span>

        {latest ? (
          <>
            <button
              type="button"
              onClick={() => setOpen(latest)}
              className="min-w-0 truncate text-body-sm font-semibold text-primary-900 hover:text-secondary-700 hover:underline"
              title={latest.title}
            >
              {latest.title}
            </button>
            <span className="hidden text-caption text-neutral-400 lg:inline">
              {[formatReportDate(latest.created_at), formatFileSize(latest.file_size)].filter(Boolean).join(" · ")}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setOpen(latest)}>
              View report
            </Button>
          </>
        ) : (
          <span className="text-body-sm text-neutral-400">
            {canUpload ? "No report uploaded yet" : "No report yet"}
          </span>
        )}

        {earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-caption font-semibold text-secondary-700 hover:underline"
          >
            <History className="size-3.5" />
            {earlier.length} earlier
          </button>
        )}

        {canUpload && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 text-caption font-semibold text-secondary-700 hover:underline disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              {busy ? "Uploading…" : latest ? "Replace" : "Upload"}
            </button>
          </>
        )}
      </span>

      {/* The archive drops below the whole header rather than inside the
          inline run, so it is not squeezed into one line. */}
      {showHistory && earlier.length > 0 && (
        <ul className="order-last w-full border-t border-neutral-100 pt-2">
          {earlier.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-700">{r.title}</span>
              <span className="text-caption text-neutral-400">
                {[formatReportDate(r.created_at), formatFileSize(r.file_size)].filter(Boolean).join(" · ")}
              </span>
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="text-caption font-semibold text-secondary-700 hover:underline"
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <ReportViewer report={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * The modal. The signed URL is minted on open and lives only as long as the
 * dialog — it is never written to the row, so a stale link cannot leak.
 */
function ReportViewer({ report, onClose }: { report: WorkstreamReport; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(REPORTS_BUCKET)
        .createSignedUrl(report.file_path, SIGNED_URL_TTL_SECONDS);
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [report.file_path]);

  const download = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(REPORTS_BUCKET)
      .createSignedUrl(report.file_path, SIGNED_URL_TTL_SECONDS, { download: `${report.title}.pdf` });
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    window.location.href = data.signedUrl;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-body font-semibold text-primary-900">{report.title}</DialogTitle>
            <p className="text-caption text-neutral-500">
              {[
                report.uploadedBy ? `Uploaded by ${report.uploadedBy}` : "Uploaded by CRO Leader",
                formatReportDate(report.created_at),
                formatFileSize(report.file_size),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void download()}>
            <Download className="mr-1.5 size-4" />
            Download
          </Button>
        </DialogHeader>

        <div className="flex-1 bg-neutral-200">
          {failed ? (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-600">
              That report could not be opened. It may have been removed.
            </p>
          ) : url ? (
            <iframe
              src={`${url}#view=Fit&zoom=page-fit&navpanes=0`}
              title={report.title}
              className="size-full border-0"
            />
          ) : (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-500">Opening…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
