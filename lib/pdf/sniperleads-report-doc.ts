import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
import {
  DEFINITIONS,
  OPPORTUNITIES_URL,
  funnelSteps,
  headlineTiles,
  outreachLines,
  type ReportModel,
} from "@/lib/sniperleads/report";

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const TEAL_700 = "#028eab";
const TEAL_300 = "#95dfee";
const TEAL_WASH = "#e5f2f5";
const AMBER_800 = "#817103";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const WHITE = "#ffffff";

const M = 54;
const FOOT = 64;

function heading(doc: InstanceType<typeof PDFDocument>, text: string, y: number, w: number) {
  doc.font(POPPINS.semibold).fontSize(12.5).fillColor(NAVY_900);
  doc.text(text, M, y, { width: w, lineBreak: false });
  return y + 24;
}

function breakFor(doc: InstanceType<typeof PDFDocument>, y: number, need: number) {
  if (y + need > doc.page.height - FOOT) {
    doc.addPage();
    return M;
  }
  return y;
}

/**
 * The SniperLeads monthly report as a PDF (client-confirmed, 2026-10-30).
 * Same content as the editor's preview and Copy for Outlook, from
 * lib/sniperleads/report.ts: summary, funnel, outreach, closing.
 */
export function renderSniperLeadsReport(doc: InstanceType<typeof PDFDocument>, m: ReportModel) {
  const W = doc.page.width - M * 2;
  const title = `${m.clientName}: ${m.monthLabel}`;

  // ---- Masthead ----------------------------------------------------
  doc.font(POPPINS.bold).fontSize(22);
  const titleH = doc.heightOfString(title, { width: W - 140 });
  const bandH = Math.max(130, 64 + titleH + 30);
  doc.rect(0, 0, doc.page.width, bandH).fill(NAVY_950);
  drawLogoChip(doc, doc.page.width - M - 122, 30);
  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text(`SNIPERLEADS MONTHLY REPORT  ·  MONTH ${m.monthNumber}`, M, 40, { width: W - 140, characterSpacing: 1.1, lineBreak: false });
  doc.font(POPPINS.bold).fontSize(22).fillColor(WHITE);
  doc.text(title, M, 60, { width: W - 140 });

  // ---- Greeting and summary ----------------------------------------
  let y = bandH + 26;
  doc.font(POPPINS.regular).fontSize(10.5).fillColor(INK);
  doc.text(`Hello ${m.greetingName},`, M, y, { width: W });
  y = doc.y + 10;
  doc.text(m.intro, M, y, { width: W, lineGap: 4 });
  y = doc.y + 18;

  const tiles = headlineTiles(m);
  const gap = 10;
  const tw = (W - gap * (tiles.length - 1)) / tiles.length;
  y = breakFor(doc, y, 64);
  tiles.forEach((t, i) => {
    const x = M + i * (tw + gap);
    doc.roundedRect(x, y, tw, 60, 6).lineWidth(0.8).strokeColor(RULE).stroke();
    doc.font(POPPINS.bold).fontSize(16).fillColor(NAVY_900);
    doc.text(t.value, x + 10, y + 9, { width: tw - 20, lineBreak: false });
    doc.font(POPPINS.regular).fontSize(8).fillColor(MUTED);
    doc.text(t.label, x + 10, y + 32, { width: tw - 20, lineGap: 1 });
  });
  y += 60 + 28;

  // ---- Funnel ------------------------------------------------------
  const steps = funnelSteps(m);
  y = breakFor(doc, y, 24 + steps.length * 22);
  y = heading(doc, "From target to deal", y, W);
  const top = Math.max(steps[0].value, 1);
  const labelW = 110;
  const numW = 50;
  const barW = W - labelW - numW - 16;
  for (const s of steps) {
    doc.font(POPPINS.regular).fontSize(9.5).fillColor(INK);
    doc.text(s.label, M, y + 2, { width: labelW, lineBreak: false });
    doc.roundedRect(M + labelW + 8, y + 2, barW, 12, 3).fill(TEAL_WASH);
    const w = (s.value / top) * barW;
    if (s.value > 0) doc.roundedRect(M + labelW + 8, y + 2, Math.max(w, 3), 12, 3).fill(TEAL_700);
    doc.font(POPPINS.semibold).fontSize(9.5).fillColor(INK);
    doc.text(s.value.toLocaleString("en-US"), M + W - numW, y + 2, { width: numW, align: "right", lineBreak: false });
    y += 22;
  }
  y += 18;

  // ---- Outreach ----------------------------------------------------
  const lines = outreachLines(m.outreach);
  // Heading plus a first row: the rows below break one at a time.
  y = breakFor(doc, y, 24 + 30);
  y = heading(doc, "Outreach this month", y, W);
  const c1 = 170;
  const c2 = 80;
  const c3 = W - c1 - c2;
  for (const l of lines) {
    doc.font(POPPINS.regular).fontSize(9.5);
    const h = Math.max(doc.heightOfString(l.note, { width: c3 - 10 }), doc.heightOfString(l.label, { width: c1 - 8 })) + 12;
    y = breakFor(doc, y, h);
    doc.fillColor(INK).text(l.label, M, y + 6, { width: c1 - 8 });
    doc.font(POPPINS.semibold).fillColor(INK).text(l.value, M + c1, y + 6, { width: c2 - 10, align: "right", lineBreak: false });
    doc.font(POPPINS.regular).fillColor(l.notStarted ? AMBER_800 : MUTED).text(l.note, M + c1 + c2, y + 6, { width: c3 - 10 });
    y += h;
    doc.rect(M, y, W, 0.6).fill(RULE);
  }
  y += 26;

  // ---- Closing -----------------------------------------------------
  y = breakFor(doc, y, 110);
  doc.font(POPPINS.regular).fontSize(10.5).fillColor(INK);
  doc.text(m.closing, M, y, { width: W, lineGap: 4 });
  y = doc.y + 12;
  const cta = `See all ${m.gm.opportunities.toLocaleString("en-US")} in GrowthMission`;
  doc.font(POPPINS.semibold).fontSize(10);
  const ctaW = doc.widthOfString(cta) + 28;
  doc.roundedRect(M, y, ctaW, 26, 5).fill(NAVY_900);
  doc.fillColor(WHITE).text(cta, M + 14, y + 7, { lineBreak: false, link: OPPORTUNITIES_URL });
  y += 26 + 6;
  doc.font(POPPINS.regular).fontSize(8.5).fillColor(FAINT).text(OPPORTUNITIES_URL.replace("https://", ""), M, y, { link: OPPORTUNITIES_URL, lineBreak: false });
  y += 22;
  doc.font(POPPINS.medium).fontSize(10.5).fillColor(INK).text(m.signerName, M, y, { lineBreak: false });
  doc.font(POPPINS.regular).fontSize(9.5).fillColor(MUTED).text("CRO Leader", M, y + 15, { lineBreak: false });
  y += 44;

  // ---- Definitions -------------------------------------------------
  y = breakFor(doc, y, 40);
  doc.rect(M, y, W, 0.6).fill(RULE);
  y += 10;
  for (const [k, v] of DEFINITIONS) {
    doc.font(POPPINS.semibold).fontSize(8).fillColor(INK).text(k, M, y, { continued: true });
    doc.font(POPPINS.regular).fillColor(MUTED).text(`  ·  ${v}`, { width: W });
    y = doc.y + 3;
  }
}
