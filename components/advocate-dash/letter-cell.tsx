"use client";

import { Download, FileText, Mail, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LETTERS_BUCKET,
  LETTER_ACCEPT,
  MAX_FILE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  formatFileSize,
  isAcceptedLetter,
  isInlineViewable,
  letterPath,
} from "@/lib/advocate-dash/files";
import type { AdvocateTarget, TargetLetter } from "@/lib/advocate-dash/targets";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

/**
 * The Note column: the drop-by letter actually delivered to this target
 * (client-confirmed, 2026-10-05, "upload the delivered letter per target").
 *
 * A file per target rather than app-written text, because the client wanted
 * the thing that was really handed over, not a reconstruction of it. The
 * standard template is one click away under "Sample Dropby Report" at the
 * top of the page, so nobody has to go looking for what to base it on.
 *
 * Replacing a letter removes the old object: there is no history here, only
 * the letter this target received. The target row itself is still
 * soft-deleted, which is the rule that matters.
 */
export function LetterCell({
  accountId,
  target,
  canEdit,
  onUploaded,
  block = false,
}: {
  accountId: string;
  target: AdvocateTarget;
  canEdit: boolean;
  onUploaded: (letter: TargetLetter | null) => void;
  /** Render as one full-width button, for the card layout below `lg`. */
  block?: boolean;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!isAcceptedLetter(file.type)) {
      toast.error("The letter must be a PDF or Word document.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("The letter must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = letterPath(accountId, target.id, file.type);

    const { error: upErr } = await supabase.storage
      .from(LETTERS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      toast.error(getFriendlyErrorMessage(upErr));
      return;
    }

    const letter: TargetLetter = {
      path,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    const { error: rowErr } = await supabase
      .from("advocate_dash_targets")
      .update({
        letter_path: path,
        letter_name: file.name,
        letter_size: file.size,
        letter_uploaded_at: letter.uploadedAt,
      })
      .eq("id", target.id);

    if (rowErr) {
      await supabase.storage.from(LETTERS_BUCKET).remove([path]);
      setBusy(false);
      toast.error(getFriendlyErrorMessage(rowErr));
      return;
    }

    // Only once the row points at the new object is the old one dead.
    const previous = target.letter?.path;
    if (previous && previous !== path) {
      await supabase.storage.from(LETTERS_BUCKET).remove([previous]);
    }

    setBusy(false);
    onUploaded(letter);
    toast.success("Letter uploaded.");
    router.refresh();
  };

  const fileInput = canEdit ? (
    <input
      ref={input}
      type="file"
      accept={LETTER_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  ) : null;

  /**
   * Card layout (client-confirmed, 2026-10-05): one full-width button
   * rather than the table cell's inline text plus a separate upload icon.
   * In a card those read as cramped links and the label truncated to
   * "Fill r…". Replacing a letter moves into the viewer dialog, so this
   * stays one control — which is what makes it a button.
   */
  if (block) {
    return (
      <>
        <button
          type="button"
          disabled={busy || (!target.letter && !canEdit)}
          onClick={() => (target.letter ? setViewing(true) : input.current?.click())}
          className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-body-sm font-semibold transition-colors disabled:opacity-50 motion-reduce:transition-none ${
            target.letter
              ? "border-neutral-300 bg-white text-primary-700 hover:border-primary-700"
              : "border-dashed border-neutral-300 bg-white text-neutral-500 hover:border-secondary-500 hover:text-secondary-700"
          }`}
        >
          {target.letter ? <Mail className="size-4 shrink-0" /> : <Upload className="size-4 shrink-0" />}
          <span className="truncate">
            {busy ? "Uploading…" : target.letter ? "Letter" : canEdit ? "Upload letter" : "No letter"}
          </span>
        </button>
        {fileInput}

        {viewing && target.letter && (
          <LetterViewer
            letter={target.letter}
            targetName={target.target_name}
            canReplace={canEdit}
            onReplace={() => {
              setViewing(false);
              input.current?.click();
            }}
            onClose={() => setViewing(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        {target.letter ? (
          <>
            <button
              type="button"
              onClick={() => setViewing(true)}
              title={target.letter.name ?? "Drop-by letter"}
              className="inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-body-sm font-medium text-secondary-700 hover:bg-secondary-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
            >
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">Letter</span>
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                aria-label={`Replace the letter for ${target.target_name}`}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-secondary-700 disabled:opacity-50"
              >
                <Upload className="size-3.5" />
              </button>
            )}
          </>
        ) : canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-body-sm text-neutral-400 hover:text-secondary-700 disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {busy ? "Uploading…" : "Upload"}
          </button>
        ) : (
          <span className="px-1.5 text-body-sm text-neutral-300">—</span>
        )}

        {fileInput}
      </span>

      {viewing && target.letter && (
        <LetterViewer
          letter={target.letter}
          targetName={target.target_name}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  );
}

/**
 * The signed URL is minted on open and lives only as long as the dialog, so
 * a stale link cannot leak. A PDF renders in the frame; a Word letter
 * cannot be rendered by any browser, so it is offered as a download — a
 * platform limit, recorded in the migration too, not a missing feature.
 */
function LetterViewer({
  letter,
  targetName,
  canReplace = false,
  onReplace,
  onClose,
}: {
  letter: TargetLetter;
  targetName: string;
  /** Only the card layout passes this — the table cell has its own
   *  replace control beside the link. */
  canReplace?: boolean;
  onReplace?: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const inline = isInlineViewable(letter.path);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(LETTERS_BUCKET)
        .createSignedUrl(letter.path, SIGNED_URL_TTL_SECONDS);
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
  }, [letter.path]);

  const download = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(LETTERS_BUCKET)
      .createSignedUrl(letter.path, SIGNED_URL_TTL_SECONDS, {
        download: letter.name ?? `dropby-letter-${targetName}`,
      });
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    window.location.href = data.signedUrl;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`flex w-[96vw] flex-col gap-0 overflow-hidden p-0 ${
          inline ? "h-[94vh] max-w-[1000px]" : "max-w-[520px]"
        }`}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-body font-semibold text-primary-900">
              Drop-by letter — {targetName}
            </DialogTitle>
            <p className="truncate text-caption text-neutral-500">
              {[letter.name, formatFileSize(letter.size)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {canReplace && onReplace && (
            <Button size="sm" variant="secondary" onClick={onReplace}>
              <Upload className="mr-1.5 size-4" />
              Replace
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => void download()}>
            <Download className="mr-1.5 size-4" />
            Download
          </Button>
        </DialogHeader>

        {failed ? (
          <p className="px-5 py-10 text-center text-body-sm text-neutral-600">
            That letter could not be opened. It may have been replaced.
          </p>
        ) : inline ? (
          <div className="flex-1 bg-neutral-200">
            {url ? (
              <iframe
                src={`${url}#view=Fit&zoom=page-fit&navpanes=0`}
                title={`Drop-by letter for ${targetName}`}
                className="size-full border-0"
              />
            ) : (
              <p className="px-5 py-10 text-center text-body-sm text-neutral-500">Opening…</p>
            )}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-body-sm text-neutral-600">
            This letter is a Word document, which a browser cannot display. Download it to read it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
