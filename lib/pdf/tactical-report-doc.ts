import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
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

const M = 54;
const FOOT = 40;

export interface TacticalPdfModel {
  clientName: string;
  monthLabel: string;
  /** "Sep", or null when last month has no published report. */
  prevLabel: string | null;
  cur: TacticalFigures;
  prev: TacticalFigures | null;
}

function breakFor(doc: InstanceType<typeof PDFDocument>, y: number, need: number) {
  if (y + need > doc.page.height - FOOT) {
    doc.addPage();
    return M;
  }
  return y;
}

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
  // Sized so a full month (five groups, 21 rows) fits on one Letter page.
  const c1 = W - 180;
  const c2 = 80;
  const c3 = 100;
  const ROW = 17;
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
      doc.font(POPPINS.regular).fontSize(9).fillColor(INK).text(r.label, M + 10, y + 4, { width: c1 - 10, lineBreak: false });
      doc.font(POPPINS.semibold).fillColor(INK).text(show(m.cur[r.key], r.percent), M + c1, y + 4, { width: c2 - 10, align: "right", lineBreak: false });
      const c = m.prev ? change(m.cur[r.key], m.prev[r.key], r) : null;
      const txt = c ? c.text : "—";
      const color = !c || c.tone === "none" || c.tone === "flat" ? FAINT : c.tone === "up" ? GREEN_700 : RED_700;
      const right = M + c1 + c2 + c3 - 10;
      doc.font(POPPINS.medium).fontSize(9).fillColor(color).text(txt, M + c1 + c2, y + 4, { width: c3 - 10, align: "right", lineBreak: false });
      // Poppins has no ▲/▼ glyphs, so the arrow is drawn as a triangle.
      if (c && c.tone !== "none" && c.arrow) {
        const ax = right - doc.widthOfString(txt) - 9;
        const ay = y + 8.5;
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
  y = breakFor(doc, y, 30);
  // pdfkit breaks text at its own 54pt bottom margin, before FOOT; let the
  // two-line footnote use the room above FOOT instead of spilling a page.
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = FOOT - 10;
  doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
  doc.text(
    "MQCs added is counted by GrowthMission from your lists. Rates are worked out from the counts: open, click and reply rates against emails sent, acceptance rate against LinkedIn invites sent.",
    M,
    y,
    { width: W, lineGap: 2 }
  );
  doc.page.margins.bottom = bottom;
}
