import type PDFDocument from "pdfkit";

import {
  REPORT_BRAND_LINE,
  REPORT_DOC_TITLE,
  REPORT_SECTIONS,
  REPORT_STRAPLINE,
  type ReportAnswers,
  type ReportField,
} from "@/lib/advocate-dash/report-form";
import { POPPINS } from "@/lib/pdf/poppins";

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const TEAL_500 = "#03b8de";
const TEAL_300 = "#95dfee";
const GREEN_600 = "#50af28";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const TINT = "#f8fafc";
const WHITE = "#ffffff";

const M = 54;
/** Content stops here; the footer lives in the band below it. */
const FOOT = 64;

export interface VisitReportDoc {
  accountName: string;
  targetName: string;
  companyName: string | null;
  address: string | null;
  advocateName: string | null;
  completedOn: string | null;
  submittedAt: string | null;
  answers: ReportAnswers;
  /** Photos are listed by caption; the images themselves are not embedded —
   *  see the note on `photoCaptions` below. */
  photoCaptions: string[];
}

/**
 * The VictoryVisit After-Action Report as a PDF (client-confirmed,
 * 2026-10-05): the artefact the MSP Owner forwards or files, in the same
 * Poppins house style as the other exports.
 *
 * All seventeen sections, in the source document's order, read straight off
 * REPORT_SECTIONS — so the PDF cannot fall out of step with the on-screen
 * form. Empty fields are skipped rather than printed as blanks: this is the
 * report of one visit, and a page of "Not recorded" lines tells the reader
 * nothing. A section with nothing in it at all is dropped entirely, with a
 * count at the end of how many were left unfilled, so the omission is
 * visible rather than silent.
 *
 * `photoCaptions`: the photos are listed, not embedded. Each one needs a
 * signed URL fetched over the network to draw, which would make rendering
 * this document depend on a remote fetch per photo. That is a deliberate
 * limit and worth revisiting once somebody actually wants the images in the
 * file; the report still records that they exist and what they show.
 *
 * Pagination is by hand through `breakFor`, never by letting pdfkit flow.
 * The rule that bites: nothing may be drawn below `page.height - FOOT`
 * during layout, because a `doc.text()` whose baseline passes the bottom
 * margin makes pdfkit continue on a new page — which is how the status
 * report export once grew four blank pages. The footer pass drops the
 * bottom margin to zero before writing, and restores it after.
 */
export function renderVisitReport(doc: InstanceType<typeof PDFDocument>, data: VisitReportDoc) {
  const W = doc.page.width - M * 2;

  // ---- Masthead ----------------------------------------------------
  doc.rect(0, 0, doc.page.width, 158).fill(NAVY_950);

  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text(REPORT_DOC_TITLE.toUpperCase(), M, 38, { width: W, characterSpacing: 1.1 });

  doc.font(POPPINS.bold).fontSize(22).fillColor(WHITE);
  doc.text(data.companyName ? `${data.targetName} — ${data.companyName}` : data.targetName, M, 62, {
    width: W,
  });

  doc.font(POPPINS.regular).fontSize(9.5).fillColor("#8fa3c4");
  doc.text(REPORT_BRAND_LINE, M, doc.y + 4, { width: W, lineBreak: false });
  doc.fillColor("#6f84a6");
  doc.text(REPORT_STRAPLINE, M, doc.y + 2, { width: W, lineBreak: false });

  // ---- Visit facts strip -------------------------------------------
  let y = 180;
  const facts: [string, string][] = [
    ["Account", data.accountName],
    ["Advocate", data.advocateName ?? "—"],
    ["Visit date", formatDate(data.completedOn) ?? "—"],
    ["Submitted", formatDate(data.submittedAt) ?? "Draft"],
  ];
  const cw = W / facts.length;
  doc.rect(M, y, W, 46).fill(TINT);
  facts.forEach(([label, value], i) => {
    const x = M + cw * i;
    if (i > 0) doc.rect(x, y + 8, 0.7, 30).fill(RULE);
    doc.font(POPPINS.semibold).fontSize(7.5).fillColor(FAINT);
    doc.text(label.toUpperCase(), x + 12, y + 10, { width: cw - 20, characterSpacing: 0.8, lineBreak: false });
    doc.font(POPPINS.semibold).fontSize(10.5).fillColor(NAVY_900);
    doc.text(value, x + 12, y + 23, { width: cw - 20, lineBreak: false, ellipsis: true });
  });
  y += 62;

  if (data.address) {
    doc.font(POPPINS.regular).fontSize(9.5).fillColor(MUTED);
    doc.text(data.address, M, y, { width: W, lineBreak: false, ellipsis: true });
    y += 20;
  }

  // ---- The seventeen sections --------------------------------------
  let skipped = 0;

  for (const section of REPORT_SECTIONS) {
    const lines = section.fields
      .map((field) => renderableFor(field, data.answers))
      .filter((l): l is Renderable => l !== null);

    const photoLines =
      section.key === "photo_verification" && data.photoCaptions.length > 0
        ? [
            {
              kind: "list" as const,
              label: `Photos attached (${data.photoCaptions.length})`,
              items: data.photoCaptions,
            },
          ]
        : [];

    const all = [...lines, ...photoLines];
    if (all.length === 0) {
      skipped += 1;
      continue;
    }

    y = heading(doc, section.title, y, W);
    if (section.intro) {
      y = breakFor(doc, y, 16);
      doc.font(POPPINS.regular).fontSize(9).fillColor(FAINT);
      doc.text(section.intro, M, y, { width: W, lineBreak: false, ellipsis: true });
      y += 16;
    }

    for (const item of all) {
      y = drawItem(doc, item, y, W);
    }
    y += 10;
  }

  if (skipped > 0) {
    y = breakFor(doc, y, 30);
    doc.font(POPPINS.regular).fontSize(8.5).fillColor(FAINT);
    doc.text(
      `${skipped} of ${REPORT_SECTIONS.length} sections were left unfilled and are omitted here.`,
      M,
      y,
      { width: W, lineBreak: false }
    );
  }

  footer(doc, data);
}

type Renderable =
  | { kind: "text"; label: string; value: string }
  | { kind: "prose"; label: string; value: string }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "pill"; label: string; value: string }
  | { kind: "flag"; label: string; value: boolean };

/** Null when the field has no answer, so the caller can skip it. */
function renderableFor(field: ReportField, answers: ReportAnswers): Renderable | null {
  const value = answers[field.key];

  switch (field.kind) {
    case "checklist": {
      const ticked = Array.isArray(value) ? value : [];
      const chosen = (field.options ?? []).filter((o) => ticked.includes(o));
      if (chosen.length === 0) return null;
      const other = field.otherKey ? text(answers[field.otherKey]) : "";
      return {
        kind: "list",
        label: field.label,
        items: chosen.map((o) => (o === "Other" && other ? `Other — ${other}` : o)),
      };
    }
    case "choice": {
      const chosen = text(value);
      return chosen ? { kind: "pill", label: field.label, value: chosen } : null;
    }
    case "yesno":
      return typeof value === "boolean" ? { kind: "flag", label: field.label, value } : null;
    case "textarea": {
      const body = text(value);
      return body.trim() ? { kind: "prose", label: field.label, value: body } : null;
    }
    case "number":
      return typeof value === "number"
        ? { kind: "text", label: field.label, value: String(value) }
        : null;
    case "date": {
      const raw = text(value);
      const shown = formatDate(raw);
      return shown ? { kind: "text", label: field.label, value: shown } : null;
    }
    default: {
      const body = text(value);
      return body.trim() ? { kind: "text", label: field.label, value: body } : null;
    }
  }
}

function drawItem(
  doc: InstanceType<typeof PDFDocument>,
  item: Renderable,
  startY: number,
  W: number
): number {
  const LABEL_W = 132;
  const bodyX = M + LABEL_W;
  const bodyW = W - LABEL_W;

  if (item.kind === "prose") {
    // Measured before the break so a paragraph is never split across the
    // footer band mid-sentence when it would fit whole on the next page.
    doc.font(POPPINS.regular).fontSize(9.5);
    const h = doc.heightOfString(item.value, { width: bodyW, lineGap: 2.5 });
    let y = breakFor(doc, startY, Math.min(h + 18, 240));
    doc.font(POPPINS.semibold).fontSize(8).fillColor(FAINT);
    doc.text(item.label.toUpperCase(), M, y + 1, { width: LABEL_W - 10, characterSpacing: 0.6 });
    doc.font(POPPINS.regular).fontSize(9.5).fillColor(INK);
    doc.text(item.value, bodyX, y, { width: bodyW, lineGap: 2.5 });
    y = Math.max(doc.y, y + 12) + 8;
    return y;
  }

  if (item.kind === "list") {
    const needed = 16 + item.items.length * 14;
    let y = breakFor(doc, startY, Math.min(needed, 200));
    doc.font(POPPINS.semibold).fontSize(8).fillColor(FAINT);
    doc.text(item.label.toUpperCase(), M, y + 1, { width: LABEL_W - 10, characterSpacing: 0.6 });
    for (const entry of item.items) {
      y = breakFor(doc, y, 16);
      doc.rect(bodyX, y + 4.5, 4, 4).fill(GREEN_600);
      doc.font(POPPINS.regular).fontSize(9.5).fillColor(INK);
      doc.text(entry, bodyX + 11, y, { width: bodyW - 11 });
      y = Math.max(doc.y, y + 13);
    }
    return y + 8;
  }

  if (item.kind === "pill") {
    const y = breakFor(doc, startY, 24);
    doc.font(POPPINS.semibold).fontSize(8).fillColor(FAINT);
    doc.text(item.label.toUpperCase(), M, y + 4, { width: LABEL_W - 10, characterSpacing: 0.6 });
    doc.font(POPPINS.semibold).fontSize(9.5);
    const w = doc.widthOfString(item.value) + 18;
    doc.roundedRect(bodyX, y, w, 18, 9).fill(TEAL_500);
    doc.fillColor(WHITE);
    doc.text(item.value, bodyX + 9, y + 4.5, { width: w - 18, lineBreak: false });
    return y + 26;
  }

  if (item.kind === "flag") {
    const y = breakFor(doc, startY, 18);
    doc.font(POPPINS.regular).fontSize(9.5).fillColor(MUTED);
    doc.text(item.label, M, y, { width: W - 60, lineBreak: false });
    doc.font(POPPINS.semibold).fillColor(item.value ? GREEN_600 : FAINT);
    doc.text(item.value ? "Yes" : "No", M + W - 50, y, { width: 50, align: "right", lineBreak: false });
    doc.rect(M, y + 16, W, 0.6).fill(RULE);
    return y + 22;
  }

  const y = breakFor(doc, startY, 20);
  doc.font(POPPINS.semibold).fontSize(8).fillColor(FAINT);
  doc.text(item.label.toUpperCase(), M, y + 1, { width: LABEL_W - 10, characterSpacing: 0.6 });
  doc.font(POPPINS.semibold).fontSize(9.5).fillColor(INK);
  doc.text(item.value, bodyX, y, { width: bodyW });
  return Math.max(doc.y, y + 13) + 7;
}

function heading(doc: InstanceType<typeof PDFDocument>, label: string, y: number, width: number) {
  const top = breakFor(doc, y, 40);
  doc.rect(M, top + 2, 3, 13).fill(TEAL_500);
  doc.font(POPPINS.bold).fontSize(12).fillColor(NAVY_900);
  doc.text(label, M + 12, top, { width: width - 12, lineBreak: false });
  return top + 24;
}

/** Starts a fresh page when the next block would run into the footer band. */
function breakFor(doc: InstanceType<typeof PDFDocument>, y: number, needed: number) {
  if (y + needed > doc.page.height - FOOT) {
    doc.addPage();
    return M;
  }
  return y;
}

/**
 * The per-page footer. The bottom margin goes to zero first: a `doc.text()`
 * below the margin makes pdfkit add a page, which is the bug that gave the
 * status report export four blank pages.
 */
function footer(doc: InstanceType<typeof PDFDocument>, data: VisitReportDoc) {
  const W = doc.page.width - M * 2;
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const fy = doc.page.height - 42;
    doc.rect(M, fy - 13, W, 0.7).fill(RULE);
    doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
    doc.text(`${data.accountName} · VictoryVisit™ · ${data.targetName}`, M, fy, {
      width: W * 0.72,
      lineBreak: false,
      ellipsis: true,
    });
    doc.text(`${i - range.start + 1} of ${range.count}`, M + W * 0.72, fy, {
      width: W * 0.28,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = keep;
  }
}

/** "5 July 2026" from a date or an ISO timestamp; null when unparseable. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function text(value: ReportAnswers[string]): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
