import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
import { OUTCOME_LABEL, type CallOutcome } from "@/lib/sdr/desk";

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const TEAL_700 = "#028eab";
const TEAL_500 = "#03b8de";
const TEAL_300 = "#95dfee";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const TINT = "#f8fafc";
const TRACK = "#f1f5f9";
const WHITE = "#ffffff";

/**
 * The outcome colours from lib/sdr/call-style.ts, as hex. That file holds
 * CSS variables, which pdfkit cannot read, so the same tokens are repeated
 * here; neutral-300 is the slate oklch value in hex.
 */
const OUTCOME_HEX: Record<CallOutcome, string> = {
  meeting_booked: "#50af28",
  connected: "#028eab",
  not_interested: "#ff5757",
  voicemail: "#6597e2",
  no_answer: "#cad5e2",
  bad_number: "#817103",
};

const M = 54;

export interface CallReportDoc {
  accountName: string;
  /** "November 1 – 6, 2026". */
  periodLabel: string;
  /** "Nov 8, 2026". */
  exportedLabel: string;
  /** [label, value] pairs: SDR and List always, Outcome and Search only when used. */
  filters: [string, string][];
  calls: number;
  connects: number;
  meetings: number;
  /** The outcome rows to list, best first, with their counts. */
  mix: [CallOutcome, number][];
}

/**
 * The Call Logs export (client-confirmed, 2026-11-08, approved mockup "Call
 * Logs PDF Export Mockup"): one page of totals for whatever the Call Logs
 * filters show, for sending to a client. No individual calls, contacts or
 * notes. Same masthead, strip and heading as the Status Report PDF.
 *
 * It is always one page, so nothing here paginates; the footer still drops
 * the bottom margin first so writing it can never spawn a blank page (see
 * status-report-doc.ts, rule 1).
 */
export function renderCallReport(doc: InstanceType<typeof PDFDocument>, data: CallReportDoc) {
  const W = doc.page.width - M * 2;

  // ---- Masthead ----------------------------------------------------
  const bandH = 150;
  doc.rect(0, 0, doc.page.width, bandH).fill(NAVY_950);
  // On its own white chip: half the wordmark vanishes against this navy (brand.ts).
  drawLogoChip(doc, doc.page.width - M - 122, 30);

  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text("SDR OUTREACH", M, 40, { width: W, characterSpacing: 1.1, lineBreak: false });
  doc.font(POPPINS.bold).fontSize(24).fillColor(WHITE);
  doc.text("Call Report", M, 58, { width: W - 140, lineBreak: false });
  doc.font(POPPINS.regular).fontSize(10).fillColor("#8fa3c4");
  doc.text(`${data.accountName}  ·  ${data.periodLabel}`, M, 98, { width: W, lineBreak: false, ellipsis: true });

  // ---- Filters line ------------------------------------------------
  let y = bandH + 24;
  let x = M;
  doc.fontSize(9);
  for (const [label, value] of data.filters) {
    doc.font(POPPINS.semibold).fillColor(NAVY_900);
    const lw = doc.widthOfString(label);
    doc.font(POPPINS.regular);
    const vw = doc.widthOfString(value);
    if (x > M && x + lw + 6 + vw > M + W) {
      x = M;
      y += 14;
    }
    doc.font(POPPINS.semibold).fillColor(NAVY_900).text(label, x, y, { lineBreak: false });
    doc.font(POPPINS.regular).fillColor(MUTED).text(value, x + lw + 6, y, { width: M + W - (x + lw + 6), lineBreak: false, ellipsis: true });
    x += lw + 6 + vw + 18;
  }
  y += 26;

  // ---- Totals strip ------------------------------------------------
  const rate = data.calls > 0 ? `${Math.round((data.connects / data.calls) * 100)}%` : "—";
  const cells: [string, string, string][] = [
    ["Calls", data.calls.toLocaleString("en-US"), NAVY_900],
    ["Connects", data.connects.toLocaleString("en-US"), NAVY_900],
    ["Connect rate", rate, TEAL_700],
    ["Meetings booked", data.meetings.toLocaleString("en-US"), NAVY_900],
  ];
  const cw = W / cells.length;
  doc.roundedRect(M, y, W, 64, 6).fill(TINT);
  cells.forEach(([label, value, ink], i) => {
    const cx = M + cw * i;
    if (i > 0) doc.rect(cx, y + 12, 0.8, 40).fill(RULE);
    doc.font(POPPINS.bold).fontSize(17).fillColor(ink);
    doc.text(value, cx + 16, y + 13, { width: cw - 32, lineBreak: false });
    doc.font(POPPINS.regular).fontSize(8.5).fillColor(FAINT);
    doc.text(label, cx + 16, y + 40, { width: cw - 32, lineBreak: false });
  });
  y += 64 + 28;

  // ---- Outcomes ----------------------------------------------------
  doc.rect(M, y + 2, 3, 13).fill(TEAL_500);
  doc.font(POPPINS.bold).fontSize(12).fillColor(NAVY_900);
  doc.text("Outcomes", M + 12, y, { width: W - 12, lineBreak: false });
  y += 28;

  const total = data.mix.reduce((t, [, n]) => t + n, 0);
  if (total === 0) {
    doc.font(POPPINS.regular).fontSize(10).fillColor(FAINT);
    doc.text("No calls with an outcome in this period.", M, y, { width: W, lineBreak: false });
  } else {
    // The stacked bar, clipped to a pill.
    doc.save();
    doc.roundedRect(M, y, W, 9, 4.5).clip();
    doc.rect(M, y, W, 9).fill(TRACK);
    let bx = M;
    for (const [o, n] of data.mix) {
      if (n === 0) continue;
      const bw = (n / total) * W;
      doc.rect(bx, y, bw, 9).fill(OUTCOME_HEX[o]);
      bx += bw;
    }
    doc.restore();
    y += 23;

    // Outcome · Calls · Share, numbers right-aligned in fixed columns.
    const numW = 70;
    const callsX = M + W - numW * 2;
    const shareX = M + W - numW;
    doc.rect(M, y, W, 0.7).fill(RULE);
    doc.font(POPPINS.semibold).fontSize(8).fillColor(FAINT);
    doc.text("OUTCOME", M, y + 8, { characterSpacing: 0.8, lineBreak: false });
    doc.text("CALLS", callsX, y + 8, { width: numW, align: "right", characterSpacing: 0.8, lineBreak: false });
    doc.text("SHARE", shareX, y + 8, { width: numW, align: "right", characterSpacing: 0.8, lineBreak: false });
    y += 25;
    doc.rect(M, y, W, 0.7).fill(RULE);

    for (const [o, n] of data.mix) {
      doc.circle(M + 3.5, y + 15, 3.5).fill(OUTCOME_HEX[o]);
      doc.font(POPPINS.regular).fontSize(10).fillColor(INK);
      doc.text(OUTCOME_LABEL[o], M + 15, y + 8, { width: callsX - M - 20, lineBreak: false });
      doc.font(POPPINS.semibold).fillColor(INK);
      doc.text(n.toLocaleString("en-US"), callsX, y + 8, { width: numW, align: "right", lineBreak: false });
      doc.font(POPPINS.regular).fillColor(MUTED);
      doc.text(`${Math.round((n / total) * 100)}%`, shareX, y + 8, { width: numW, align: "right", lineBreak: false });
      y += 30;
      doc.rect(M, y, W, 0.7).fill(RULE);
    }
  }

  // ---- Footer ------------------------------------------------------
  const keep = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const fy = doc.page.height - 42;
  doc.rect(M, fy - 13, W, 0.7).fill(RULE);
  doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
  doc.text(`${data.accountName} · Call Report · Exported ${data.exportedLabel}`, M, fy, { width: W * 0.8, lineBreak: false, ellipsis: true });
  doc.text("1 of 1", M + W * 0.8, fy, { width: W * 0.2, align: "right", lineBreak: false });
  doc.page.margins.bottom = keep;
}
