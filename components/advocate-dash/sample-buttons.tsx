"use client";

import { FileText, Mail } from "lucide-react";
import { useState } from "react";

import { FieldControl, SectionShell } from "@/components/advocate-dash/report-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  REPORT_BRAND_LINE,
  REPORT_DOC_TITLE,
  REPORT_SECTIONS,
  REPORT_STRAPLINE,
} from "@/lib/advocate-dash/report-form";
import {
  SAMPLE_LETTER,
  SAMPLE_REPORT_ANSWERS,
  SAMPLE_REPORT_HEADER,
} from "@/lib/advocate-dash/samples";

/**
 * "Sample Dropby Report" and "Sample Victory Visit Report"
 * (client-confirmed, 2026-10-05).
 *
 * These replace the Status Report control the other fifteen workstreams
 * carry in this slot. AdvocateDash has no single per-account report — it has
 * one report per drop-by, in the table below — so what belongs up here is
 * the pair of worked examples that show an MSP what the service produces.
 *
 * Both are static and identical for every account, so they are built in
 * rather than uploaded: there is nothing tenant-specific to vary, and an
 * upload per tenant would let one account's sample drift from another's.
 *
 * The visit report sample renders through the same FieldControl the real
 * form uses, in read-only mode, so it cannot show a field the form lacks.
 */
export function SampleButtons() {
  const [open, setOpen] = useState<"letter" | "report" | null>(null);

  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen("letter")}>
          <Mail className="mr-1.5 size-4" />
          Sample Dropby Report
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen("report")}>
          <FileText className="mr-1.5 size-4" />
          Sample Victory Visit Report
        </Button>
      </span>

      {open === "letter" && <SampleLetterDialog onClose={() => setOpen(null)} />}
      {open === "report" && <SampleReportDialog onClose={() => setOpen(null)} />}
    </>
  );
}

function SampleLetterDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[94vw] max-w-[640px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-body font-semibold text-primary-900">
              Sample drop-by letter
            </DialogTitle>
            <p className="text-caption text-neutral-500">
              The note an Advocate hands over at the door
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-neutral-100 p-5">
          {/* Shown as a sheet of paper, because that is what it is: the
              thing the advocate physically leaves behind. */}
          <article className="mx-auto max-w-[520px] rounded-md bg-white px-8 py-9 shadow-lift">
            <p className="text-body font-semibold text-primary-900">{SAMPLE_LETTER.greeting}</p>
            <p className="mt-1 text-body-sm text-neutral-600">{SAMPLE_LETTER.intro}</p>
            <div className="mt-4 flex flex-col gap-3">
              {SAMPLE_LETTER.paragraphs.map((para) => (
                <p key={para} className="text-body-sm leading-relaxed text-neutral-700">
                  {para}
                </p>
              ))}
            </div>
            <p className="mt-6 text-body-sm text-neutral-700">{SAMPLE_LETTER.signOff}</p>
            <div className="mt-3 flex flex-col">
              {SAMPLE_LETTER.signature.map((line) => (
                <span key={line} className="text-body-sm text-neutral-600">
                  {line}
                </span>
              ))}
            </div>
          </article>
          <p className="mx-auto mt-3 max-w-[520px] text-caption text-neutral-500">
            The bracketed lines are filled in per MSP. The letter actually delivered to each target
            is uploaded against that target in the table below.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SampleReportDialog({ onClose }: { onClose: () => void }) {
  const noop = () => {};

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-neutral-200 py-3.5 pl-5 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-body font-semibold text-primary-900">
              Sample Victory Visit Report
            </DialogTitle>
            <p className="text-caption text-neutral-500">
              {SAMPLE_REPORT_HEADER.accountName} · {SAMPLE_REPORT_HEADER.targetName} ·{" "}
              {SAMPLE_REPORT_HEADER.advocate} · {SAMPLE_REPORT_HEADER.visitDate}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white">
          <div className="border-b border-neutral-200 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] px-5 py-4">
            <p className="text-body-sm font-semibold text-white">{REPORT_DOC_TITLE}</p>
            <p className="mt-0.5 text-caption text-white/70">{REPORT_BRAND_LINE}</p>
            <p className="text-caption text-white/55">{REPORT_STRAPLINE}</p>
          </div>

          {REPORT_SECTIONS.map((section, i) => (
            <SectionShell key={section.key} section={section} index={i}>
              <div className="flex flex-col gap-4">
                {section.fields.map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    answers={SAMPLE_REPORT_ANSWERS}
                    readOnly
                    onChange={noop}
                  />
                ))}
              </div>
            </SectionShell>
          ))}

          <p className="border-t border-neutral-100 px-5 py-4 text-caption text-neutral-400">
            A worked example, taken from a real VictoryVisit. Every account's own reports are filed
            against their targets in the table below.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
