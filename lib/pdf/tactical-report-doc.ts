import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
import {
  STATUS_LABEL,
  doneLabel,
  reportOrder,
  shortDate,
  summary,
  type DeliverableSnapshot,
  type DeliverableStatus,
} from "@/lib/programs/deliverables";
import { HEADLINE_LABEL, FIGURE_DEF, TACTICAL_HEADLINE, TACTICAL_TABLE, change, show, type TacticalFigures } from "@/lib/programs/tactical";

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const TEAL_300 = "#95dfee";
const TEAL_WASH = "#e5f2f5";
const GREEN_700 = "#418d20";
const RED_700 = "#ad0000";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const WHITE = "#ffffff";
const SLATE_100 = "#f1f5f9";
const TEAL_800 = "#056a80";
const GREEN_100 = "#ebf2e8";
const GREEN_800 = "#326a1b";
const AMBER_100 = "#f5f3e5";
const AMBER_800 = "#817103";

const M = 54;
const FOOT = 40;

export interface TacticalPdfModel {
  clientName: string;
  monthLabel: string;
  /** "Sep", or null when last month has no published report. */
  prevLabel: string | null;
  cur: TacticalFigures;
  prev: TacticalFigures | null;
  /** Next Deliverables for the month; an empty list leaves the page out. */
  deliverables: DeliverableSnapshot[];
}

/**
 * pdfkit opens a page by itself when text runs past its own 54pt bottom
 * margin — one stray page per text call. Page one's table runs to FOOT, so
 * the margin is lowered there (and on any page breakFor opens) and put back
 * once the table is drawn.
 */
function roomToFoot(doc: InstanceType<typeof PDFDocument>) {
  doc.page.margins.bottom = FOOT - 10;
}

function breakFor(doc: InstanceType<typeof PDFDocument>, y: number, need: number) {
  if (y + need > doc.page.height - FOOT) {
    doc.addPage();
    roomToFoot(doc);
    return M;
  }
  return y;
}

const FOOTNOTE =
  "MQCs added is counted by GrowthMission from your lists. Rates are worked out from the counts: open, click and reply rates against emails sent, acceptance rate against LinkedIn invites sent.";

/**
 * The TacticalLeads monthly report as a PDF (client-confirmed 2026-11-16,
 * approved mockup "Program Reports Mockup"). Same figures as the Intel tab:
 * the headline band, then every deliverable with this month and the change
 * from last month. Actuals only, no dollar figures.
 */
export function renderTacticalReport(doc: InstanceType<typeof PDFDocument>, m: TacticalPdfModel) {
  const W = doc.page.width - M * 2;
  const title = `${m.clientName}: ${m.monthLabel}`;

  // ---- Masthead ----------------------------------------------------
  doc.font(POPPINS.bold).fontSize(22);
  const titleH = doc.heightOfString(title, { width: W - 140 });
  const bandH = Math.max(108, 64 + titleH + 18);
  doc.rect(0, 0, doc.page.width, bandH).fill(NAVY_950);
  drawLogoChip(doc, doc.page.width - M - 122, 30);
  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text("TACTICALLEADS MONTHLY REPORT", M, 40, { width: W - 140, characterSpacing: 1.1, lineBreak: false });
  doc.font(POPPINS.bold).fontSize(22).fillColor(WHITE);
  doc.text(title, M, 60, { width: W - 140 });

  // ---- Headline tiles ----------------------------------------------
  let y = bandH + 26;
  const gap = 8;
  const tw = (W - gap * (TACTICAL_HEADLINE.length - 1)) / TACTICAL_HEADLINE.length;
  TACTICAL_HEADLINE.forEach((k, i) => {
    const x = M + i * (tw + gap);
    const def = FIGURE_DEF[k];
    doc.roundedRect(x, y, tw, 62, 6).lineWidth(0.8).strokeColor(RULE).stroke();
    doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900);
    doc.text(show(m.cur[k], def.percent), x + 9, y + 9, { width: tw - 18, lineBreak: false });
    doc.font(POPPINS.regular).fontSize(7.5).fillColor(MUTED);
    doc.text(HEADLINE_LABEL[k] ?? def.label, x + 9, y + 32, { width: tw - 18, lineGap: 1 });
  });
  y += 62 + 20;

  // ---- Deliverables ------------------------------------------------
  // A full month (five groups, 21 rows) stays on one Letter page: rows are
  // 17pt, closing up (to 14pt at the least) when a long client name gives
  // the masthead a second or third line. Below 14pt the table moves on to a
  // new page at a group or row boundary instead of crowding.
  const c1 = W - 180;
  const c2 = 80;
  const c3 = 100;
  const rowCount = TACTICAL_TABLE.reduce((n, g) => n + g.rows.length, 0);
  doc.font(POPPINS.regular).fontSize(8);
  const footnoteH = doc.heightOfString(FOOTNOTE, { width: W, lineGap: 2 });
  const fixed = TACTICAL_TABLE.length * 30 + footnoteH + 4;
  // Two points of slack, so rounding never tips the footnote onto a page of its own.
  const fit = (doc.page.height - FOOT - y - fixed - 2) / rowCount;
  const ROW = Math.max(14, Math.min(17, Math.floor(fit * 10) / 10));
  const textY = (ROW - 9) / 2;
  const bottom = doc.page.margins.bottom;
  roomToFoot(doc);
  for (const g of TACTICAL_TABLE) {
    y = breakFor(doc, y, 24 + ROW * 2);
    doc.roundedRect(M, y, W, 20, 4).fill(TEAL_WASH);
    doc.font(POPPINS.semibold).fontSize(9.5).fillColor(NAVY_900).text(g.title, M + 10, y + 5, { width: c1, lineBreak: false });
    doc.font(POPPINS.medium).fontSize(8).fillColor(MUTED);
    doc.text(m.monthLabel.split(" ")[0], M + c1, y + 6, { width: c2 - 10, align: "right", lineBreak: false });
    doc.text(m.prevLabel ? `vs ${m.prevLabel}` : "", M + c1 + c2, y + 6, { width: c3 - 10, align: "right", lineBreak: false });
    y += 22;
    for (const r of g.rows) {
      y = breakFor(doc, y, ROW);
      doc.font(POPPINS.regular).fontSize(9).fillColor(INK).text(r.label, M + 10, y + textY, { width: c1 - 10, lineBreak: false });
      doc.font(POPPINS.semibold).fillColor(INK).text(show(m.cur[r.key], r.percent), M + c1, y + textY, { width: c2 - 10, align: "right", lineBreak: false });
      const c = m.prev ? change(m.cur[r.key], m.prev[r.key], r) : null;
      const txt = c ? c.text : "—";
      const color = !c || c.tone === "none" || c.tone === "flat" ? FAINT : c.tone === "up" ? GREEN_700 : RED_700;
      const right = M + c1 + c2 + c3 - 10;
      doc.font(POPPINS.medium).fontSize(9).fillColor(color).text(txt, M + c1 + c2, y + textY, { width: c3 - 10, align: "right", lineBreak: false });
      // Poppins has no ▲/▼ glyphs, so the arrow is drawn as a triangle.
      if (c && c.tone !== "none" && c.arrow) {
        const ax = right - doc.widthOfString(txt) - 9;
        const ay = y + ROW / 2;
        const up = c.arrow === "▲";
        doc
          .polygon(up ? [ax, ay + 3] : [ax, ay - 2], up ? [ax + 6, ay + 3] : [ax + 6, ay - 2], up ? [ax + 3, ay - 2] : [ax + 3, ay + 3])
          .fill(color);
      }
      y += ROW;
      doc.rect(M, y, W, 0.6).fill(RULE);
    }
    y += 8;
  }

  // ---- Footnote ----------------------------------------------------
  y = breakFor(doc, y, footnoteH + 4);
  doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
  doc.text(FOOTNOTE, M, y, { width: W, lineGap: 2 });
  doc.page.margins.bottom = bottom;

  if (m.deliverables.length > 0) renderDeliverables(doc, m);
}

const PILL: Record<DeliverableStatus, [string, string]> = {
  not_started: [SLATE_100, MUTED],
  in_progress: [TEAL_WASH, TEAL_800],
  done: [GREEN_100, GREEN_800],
};

function pill(doc: InstanceType<typeof PDFDocument>, x: number, y: number, text: string, [bg, fg]: [string, string]) {
  doc.font(POPPINS.semibold).fontSize(7.5);
  const w = doc.widthOfString(text) + 14;
  doc.roundedRect(x, y, w, 14, 7).fill(bg);
  doc.fillColor(fg).text(text, x + 7, y + 3.2, { lineBreak: false });
}

/**
 * Next Deliverables on its own page (client-confirmed 2026-11-18, approved
 * mockup "Next Deliverables Mockup"), so page one keeps its fitted layout.
 * Every row is measured before it's drawn: long names and notes wrap inside
 * their column, rows never split, and a row that doesn't fit starts a new
 * page with the column header repeated.
 */
function renderDeliverables(doc: InstanceType<typeof PDFDocument>, m: TacticalPdfModel) {
  const W = doc.page.width - M * 2;
  // Wrapped text past pdfkit's own bottom margin would open a page by
  // itself, so rows stop at that margin rather than at FOOT.
  const limit = doc.page.height - doc.page.margins.bottom;
  const rows = reportOrder(m.deliverables);
  const s = summary(m.deliverables);

  // Columns: Deliverable | Status | Waiting on | Due | Note
  const cols = [
    { label: "Deliverable", w: 140 },
    { label: "Status", w: 80 },
    { label: "Waiting on", w: 70 },
    { label: "Due", w: 72 },
    { label: "Note", w: W - 140 - 80 - 70 - 72 },
  ];
  const xs = cols.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? M : acc[i - 1] + cols[i - 1].w], []);
  const PAD_X = 8;
  const PAD_Y = 8;

  const columnHeader = (y: number) => {
    doc.roundedRect(M, y, W, 20, 4).fill(TEAL_WASH);
    doc.font(POPPINS.medium).fontSize(8).fillColor(MUTED);
    cols.forEach((c, i) => doc.text(c.label, xs[i] + PAD_X, y + 6, { width: c.w - PAD_X * 2, lineBreak: false }));
    return y + 20;
  };

  // ---- Page header ---------------------------------------------------
  doc.addPage();
  // The band grows with the title, so a long client name wraps inside it.
  const title = `${m.clientName}: ${m.monthLabel}`;
  doc.font(POPPINS.bold).fontSize(14);
  const titleH = doc.heightOfString(title, { width: W - 140 });
  const bandH = Math.max(84, 46 + titleH + 20);
  doc.rect(0, 0, doc.page.width, bandH).fill(NAVY_950);
  drawLogoChip(doc, doc.page.width - M - 122, 26);
  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text("TACTICALLEADS MONTHLY REPORT", M, 28, { width: W - 140, characterSpacing: 1.1, lineBreak: false });
  doc.font(POPPINS.bold).fontSize(14).fillColor(WHITE);
  doc.text(title, M, 46, { width: W - 140 });

  let y = bandH + 28;
  doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900).text("Next Deliverables", M, y, { lineBreak: false });
  const tally = `${s.done} of ${s.total} done`;
  doc.font(POPPINS.semibold).fontSize(8.5);
  const tallyW = doc.widthOfString(tally);
  doc.fillColor(MUTED).text(tally, M + W - tallyW, y + 5, { lineBreak: false });
  if (s.waiting > 0) {
    const t = `${s.waiting} waiting on you`;
    doc.font(POPPINS.semibold).fontSize(7.5);
    pill(doc, M + W - tallyW - 12 - (doc.widthOfString(t) + 14), y + 3, t, [AMBER_100, AMBER_800]);
  }
  y += 24;
  doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED).text("What CRO Leader is setting up next, and anything waiting on you", M, y, { width: W, lineBreak: false });
  y += 24;
  y = columnHeader(y);

  // ---- Rows ----------------------------------------------------------
  for (const d of rows) {
    const done = d.status === "done";
    const nameW = cols[0].w - PAD_X * 2;
    const noteW = cols[4].w - PAD_X * 2;
    doc.font(POPPINS.semibold).fontSize(9);
    const nameH = doc.heightOfString(d.name, { width: nameW, lineGap: 1.5 });
    doc.font(POPPINS.regular).fontSize(8.5);
    const noteH = d.note ? doc.heightOfString(d.note, { width: noteW, lineGap: 1.5 }) : 12;
    const h = Math.max(nameH, noteH, 14) + PAD_Y * 2;

    if (y + h > limit) {
      doc.addPage();
      y = columnHeader(M);
    }

    doc.font(POPPINS.semibold).fontSize(9).fillColor(done ? MUTED : INK);
    doc.text(d.name, xs[0] + PAD_X, y + PAD_Y, { width: nameW, lineGap: 1.5 });

    pill(doc, xs[1] + PAD_X, y + PAD_Y - 1, STATUS_LABEL[d.status], PILL[d.status]);

    if (done) {
      doc.font(POPPINS.regular).fontSize(9).fillColor(FAINT).text("—", xs[2] + PAD_X, y + PAD_Y, { lineBreak: false });
    } else if (d.waiting_on === "client") {
      pill(doc, xs[2] + PAD_X, y + PAD_Y - 1, "You", [AMBER_100, AMBER_800]);
    } else {
      doc.font(POPPINS.regular).fontSize(9).fillColor(MUTED).text("CRO Leader", xs[2] + PAD_X, y + PAD_Y, { lineBreak: false });
    }

    const due = done ? doneLabel(d.done_at) : shortDate(d.due_date);
    doc.font(POPPINS.regular).fontSize(9).fillColor(due === "—" ? FAINT : INK).text(due, xs[3] + PAD_X, y + PAD_Y, { width: cols[3].w - PAD_X * 2, lineBreak: false });

    doc.font(POPPINS.regular).fontSize(8.5).fillColor(d.note ? MUTED : FAINT);
    doc.text(d.note || "—", xs[4] + PAD_X, y + PAD_Y + 0.5, { width: noteW, lineGap: 1.5 });

    y += h;
    doc.rect(M, y, W, 0.6).fill(RULE);
  }
}
