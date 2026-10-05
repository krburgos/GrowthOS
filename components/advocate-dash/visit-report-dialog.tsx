"use client";

import { Download, FileText, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FieldControl, SectionShell } from "@/components/advocate-dash/report-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MAX_FILE_BYTES,
  PHOTOS_BUCKET,
  PHOTO_ACCEPT,
  SIGNED_URL_TTL_SECONDS,
  formatFileSize,
  isAcceptedPhoto,
  photoPath,
} from "@/lib/advocate-dash/files";
import {
  REPORT_BRAND_LINE,
  REPORT_SECTIONS,
  REPORT_STRAPLINE,
  reportProgress,
  type ReportAnswers,
} from "@/lib/advocate-dash/report-form";
import type { AdvocateTarget } from "@/lib/advocate-dash/targets";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

interface Photo {
  id: string;
  file_path: string;
  caption: string | null;
  file_size: number | null;
  url: string | null;
}

/**
 * The VictoryVisit After-Action Report, as a fillable form
 * (client-confirmed, 2026-10-05, "all 17 sections").
 *
 * Saving is explicit rather than per-keystroke. Seventeen sections of
 * autosave would be a write on every character in a seventeen-paragraph
 * summation, and the advocate writes this up in one sitting; "Save draft"
 * and "Submit report" also make the draft/submitted distinction visible,
 * which is what the table's own column reads off.
 *
 * Visit details are prefilled from the target row the first time the form
 * is opened — the advocate, the account and its address are already on the
 * row, and retyping them is how two records drift apart.
 */
export function VisitReportDialog({
  accountId,
  target,
  canEdit,
  onClose,
}: {
  accountId: string;
  target: AdvocateTarget;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<ReportAnswers | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [{ data: report, error }, { data: photoRows }] = await Promise.all([
        supabase
          .from("advocate_dash_visit_reports")
          .select("answers, submitted_at")
          .eq("target_id", target.id)
          .maybeSingle(),
        supabase
          .from("advocate_dash_visit_photos")
          .select("id, file_path, caption, file_size")
          .eq("target_id", target.id)
          .is("archived_at", null)
          .order("created_at"),
      ]);
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }

      const stored = (report?.answers as ReportAnswers | undefined) ?? null;
      setAnswers(stored && Object.keys(stored).length > 0 ? stored : prefillFrom(target));
      setSubmittedAt((report?.submitted_at as string | null) ?? null);

      const rows = (photoRows ?? []) as Omit<Photo, "url">[];
      const signed = await Promise.all(
        rows.map(async (row) => {
          const { data } = await supabase.storage
            .from(PHOTOS_BUCKET)
            .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS);
          return { ...row, url: data?.signedUrl ?? null };
        })
      );
      if (!cancelled) setPhotos(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const change = (key: string, value: ReportAnswers[string]) => {
    setAnswers((prev) => ({ ...(prev ?? {}), [key]: value }));
    setDirty(true);
  };

  const save = async (submit: boolean) => {
    if (!answers) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("advocate_dash_visit_reports").upsert(
      {
        account_id: accountId,
        target_id: target.id,
        answers,
        submitted_at: submit ? new Date().toISOString() : submittedAt,
      },
      { onConflict: "target_id" }
    );
    setBusy(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setDirty(false);
    if (submit) setSubmittedAt(new Date().toISOString());
    toast.success(submit ? "Report submitted." : "Draft saved.");
    router.refresh();
  };

  const uploadPhoto = async (file: File) => {
    if (!isAcceptedPhoto(file.type)) {
      toast.error("Photos must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Photos must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = photoPath(accountId, target.id, file.type);

    const { error: upErr } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      toast.error(getFriendlyErrorMessage(upErr));
      return;
    }

    // The row is what the app reads; insert it second so a failed upload
    // never leaves a row pointing at nothing.
    const { data: row, error: rowErr } = await supabase
      .from("advocate_dash_visit_photos")
      .insert({
        account_id: accountId,
        target_id: target.id,
        file_path: path,
        file_size: file.size,
        caption: file.name,
      })
      .select("id, file_path, caption, file_size")
      .single();

    if (rowErr || !row) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
      setBusy(false);
      toast.error(getFriendlyErrorMessage(rowErr));
      return;
    }

    const { data: signed } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    setPhotos((prev) => [...prev, { ...(row as Omit<Photo, "url">), url: signed?.signedUrl ?? null }]);
    setBusy(false);
    router.refresh();
  };

  const removePhoto = async (photo: Photo) => {
    const before = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    const supabase = createClient();
    // Archived, not deleted — the repo-wide soft-delete rule. The object
    // goes, because nothing references it once the row is retired.
    const { error } = await supabase
      .from("advocate_dash_visit_photos")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", photo.id);
    if (error) {
      setPhotos(before);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.file_path]);
    router.refresh();
  };

  const progress = answers ? reportProgress(answers) : { done: 0, total: REPORT_SECTIONS.length };
  const title = target.company_name
    ? `${target.target_name} · ${target.company_name}`
    : target.target_name;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-body font-semibold text-primary-900">
              Victory Visit Report — {title}
            </DialogTitle>
            <p className="text-caption text-neutral-500">
              {submittedAt ? "Submitted" : "Draft"} · {progress.done} of {progress.total} sections
            </p>
          </div>
          {submittedAt && (
            <Button size="sm" variant="secondary" asChild>
              <a href={`/api/advocate-dash/${target.id}/report`}>
                <Download className="mr-1.5 size-4" />
                PDF
              </a>
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white">
          {failed ? (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-600">
              That report could not be opened. Close this and try again.
            </p>
          ) : !answers ? (
            <p className="flex items-center justify-center gap-2 px-5 py-10 text-body-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Opening…
            </p>
          ) : (
            <>
              {REPORT_SECTIONS.map((section, i) => (
                <SectionShell key={section.key} section={section} index={i}>
                  <div className="flex flex-col gap-4">
                    {section.fields.map((field) => (
                      <FieldControl
                        key={field.key}
                        field={field}
                        answers={answers}
                        readOnly={!canEdit}
                        onChange={change}
                      />
                    ))}
                  </div>

                  {/* Photos belong to the section whose boxes they evidence,
                      not in an appendix at the end of the form. */}
                  {section.key === "photo_verification" && (
                    <div className="mt-4 border-t border-neutral-100 pt-4">
                      <p className="mb-2 text-caption text-neutral-700">Photos</p>
                      {photos.length === 0 && (
                        <p className="mb-2 text-body-sm text-neutral-400">
                          {canEdit ? "No photos yet." : "No photos were attached."}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2.5">
                        {photos.map((photo) => (
                          <figure
                            key={photo.id}
                            className="relative w-[128px] overflow-hidden rounded-md border border-neutral-200"
                          >
                            {photo.url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- a
                              // short-lived signed URL cannot be optimised by next/image.
                              <img
                                src={photo.url}
                                alt={photo.caption ?? "Visit photo"}
                                className="h-[90px] w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-[90px] w-full items-center justify-center bg-neutral-100 text-caption text-neutral-400">
                                Unavailable
                              </span>
                            )}
                            <figcaption className="truncate px-1.5 py-1 text-[10.5px] text-neutral-500">
                              {formatFileSize(photo.file_size) ?? photo.caption ?? "Photo"}
                            </figcaption>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => void removePhoto(photo)}
                                aria-label="Remove this photo"
                                className="absolute right-1 top-1 rounded bg-white/90 p-1 text-neutral-500 hover:text-error-700"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </figure>
                        ))}

                        {canEdit && (
                          <>
                            <input
                              ref={photoInput}
                              type="file"
                              accept={PHOTO_ACCEPT}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void uploadPhoto(file);
                              }}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => photoInput.current?.click()}
                              className="flex h-[112px] w-[128px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 text-caption text-neutral-500 hover:border-secondary-500 hover:text-secondary-700 disabled:opacity-50"
                            >
                              <ImagePlus className="size-4" />
                              Add photo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </SectionShell>
              ))}

              <p className="border-t border-neutral-100 px-5 py-4 text-caption text-neutral-400">
                {REPORT_BRAND_LINE} · {REPORT_STRAPLINE}
              </p>
            </>
          )}
        </div>

        {canEdit && answers && (
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            <span className="text-caption text-neutral-500">
              {dirty ? "Unsaved changes" : submittedAt ? "Submitted" : "Saved"}
            </span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void save(false)}>
                Save draft
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void save(true)}>
                {submittedAt ? "Save & resubmit" : "Submit report"}
              </Button>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the form already knows from the target row. Only the fields that are
 * literally the same thing under two names — not a guess at the rest.
 */
function prefillFrom(target: AdvocateTarget): ReportAnswers {
  return {
    advocate_name: target.advocate?.name ?? "",
    target_account: target.company_name
      ? `${target.target_name} — ${target.company_name}`
      : target.target_name,
    account_address: target.address ?? "",
    visit_date: target.completed_on ?? "",
    advocate_signature: target.advocate?.name ?? "",
  };
}
