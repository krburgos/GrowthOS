import type PDFDocument from "pdfkit";

import { drawLogo, drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
import {
  QUESTIONNAIRE_SECTIONS,
  TOTAL_QUESTION_COUNT,
  arrayAnswer,
  countAnswered,
  type QuestionDef,
} from "@/lib/questionnaire/questions";

type Doc = InstanceType<typeof PDFDocument>;
export type AnswerValue = string | number | string[] | null | undefined;

const NAVY = "#022a66";
const NAVY_2 = "#113c7b";
const TEAL = "#028eab";
const TEAL_BRIGHT = "#03b8de";
const INK = "#262e40";
const INK_2 = "#414a5c";
const MUTED = "#707c93";
const FAINT = "#9aa4b8";
const RULE = "#e2e6ed";
const ROW_RULE = "#eef1f5";
const ZEBRA = "#f8f9fb";
const CHIP_BG = "#e7ecf3";
const YES = "#418d20";
const YES_BG = "#ebf2e8";
const NO = "#9b3b3b";
const NO_BG = "#f7ecec";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 44;
/** The route creates the document with these side margins. */
export const QUESTIONNAIRE_PDF_MARGIN = M;
const CONTENT_W = PAGE_W - M * 2;
const BODY_TOP = 58;
const BODY_BOTTOM = PAGE_H - 52;
const ANSWER_W = 136;
const NUM_W = 18;
const ROW_PAD = 6;
const QUESTION_W = CONTENT_W - ROW_PAD * 2 - NUM_W - 8 - ANSWER_W - 8;
const WIDE_TEXT_THRESHOLD = 28;

const F = POPPINS;

const PARTS = [
  { part: "growth" as const, label: "Growth Solution" },
  { part: "icp" as const, label: "Ideal Customer Profile" },
];

const GLANCE: { key: string; label: string }[] = [
  { key: "overview_employees", label: "Employees" },
  { key: "overview_locations", label: "Locations" },
  { key: "sales_team_count", label: "Sales professionals" },
  { key: "strategy_average_mrr", label: "Avg. MRR per agreement" },
  { key: "strategy_deals_per_month", label: "Deals closed per month" },
  { key: "leadgen_mql_count", label: "MQLs" },
];

const isBlank = (v: AnswerValue) =>
  Array.isArray(v) ? v.every((x) => !String(x ?? "").trim()) : v === null || v === undefined || v === "";

function formatNumber(key: string, v: AnswerValue) {
  if (isBlank(v)) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${key.includes("mrr") ? "$" : ""}${n.toLocaleString("en-US")}`;
}

// ---------- small drawing helpers (each returns the width it used) ----------

function pill(doc: Doc, x: number, y: number, yes: boolean): number {
  const label = yes ? "Yes" : "No";
  doc.font(F.semibold).fontSize(8);
  const w = 6 + 9 + 4 + doc.widthOfString(label) + 8;
  doc.roundedRect(x, y, w, 14, 7).fill(yes ? YES_BG : NO_BG);
  const cx = x + 6 + 4.5;
  const cy = y + 7;
  doc.circle(cx, cy, 4.5).fill(yes ? YES : NO);
  doc.lineWidth(1.1).strokeColor("#ffffff").lineCap("round").lineJoin("round");
  if (yes) {
    doc.moveTo(cx - 2, cy + 0.1).lineTo(cx - 0.6, cy + 1.5).lineTo(cx + 2.1, cy - 1.5).stroke();
  } else {
    doc.moveTo(cx - 1.6, cy - 1.6).lineTo(cx + 1.6, cy + 1.6).stroke();
    doc.moveTo(cx + 1.6, cy - 1.6).lineTo(cx - 1.6, cy + 1.6).stroke();
  }
  doc.fillColor(yes ? YES : NO).text(label, x + 6 + 9 + 4, y + 2.4, { lineBreak: false });
  return w;
}

function chip(doc: Doc, x: number, y: number, label: string): number {
  doc.font(F.semibold).fontSize(8);
  const w = doc.widthOfString(label) + 16;
  doc.roundedRect(x, y, w, 14, 3).fill(CHIP_BG);
  doc.fillColor(NAVY_2).text(label, x + 8, y + 2.4, { lineBreak: false });
  return w;
}

function scaleDots(doc: Doc, x: number, y: number, value: number): number {
  for (let n = 1; n <= 4; n++) {
    doc.circle(x + 3.5 + (n - 1) * 10, y + 7, 3.5).fill(n <= value ? NAVY : RULE);
  }
  const label = `${value} / 4`;
  doc.font(F.medium).fontSize(8).fillColor(MUTED).text(label, x + 42, y + 2.4, { lineBreak: false });
  return 42 + doc.widthOfString(label);
}

// ---------- tick lists, rankings and lists (ICP, client-confirmed 2026-10-14) ----------

interface ChipItem {
  label: string;
  rank?: number;
  tick?: boolean;
  /** Typed "Others" text: outlined rather than filled, so it reads as the respondent's own words. */
  outlined?: boolean;
}

const CHIP_H = 14;
const CHIP_GAP = 4;
const isChipType = (q: QuestionDef) => q.type === "multi" || q.type === "rank" || q.type === "list";

function chipItems(q: QuestionDef, answers: Record<string, AnswerValue>): ChipItem[] {
  const picked = arrayAnswer(answers[q.key]);
  const other = answers[`${q.key}_other`];
  const otherText = typeof other === "string" && other.trim() ? other.trim() : null;
  const items: ChipItem[] = [];
  if (q.type === "rank" || q.type === "list") {
    picked.forEach((label, i) => items.push({ label, rank: i + 1 }));
  } else {
    for (const option of picked) {
      if (q.otherOption === option && otherText) {
        items.push({ label: `${option}: ${otherText}`, tick: true });
      } else if (q.detail?.option === option && !isBlank(answers[q.detail.key])) {
        const d = answers[q.detail.key];
        items.push({ label: `${option}: ${typeof d === "number" ? d.toLocaleString("en-US") : String(d)}`, tick: true });
      } else {
        items.push({ label: option, tick: true });
      }
    }
  }
  if (q.other && otherText) items.push({ label: `Others: ${otherText}`, outlined: true });
  return items;
}

function chipWidth(doc: Doc, item: ChipItem, maxW: number) {
  doc.font(F.semibold).fontSize(8);
  return Math.min(maxW, doc.widthOfString(item.label) + 16 + (item.rank ? 14 : item.tick ? 9 : 0));
}

/** Lays chips out in rows that wrap at `width`; positions are relative to the block's top-left. */
function layoutChips(doc: Doc, items: ChipItem[], width: number) {
  let x = 0;
  let y = 0;
  const placed = items.map((item) => {
    const w = chipWidth(doc, item, width);
    if (x > 0 && x + w > width) {
      x = 0;
      y += CHIP_H + CHIP_GAP;
    }
    const at = { item, x, y, w };
    x += w + CHIP_GAP;
    return at;
  });
  return { placed, height: items.length > 0 ? y + CHIP_H : 0 };
}

function drawChipItem(doc: Doc, x: number, y: number, w: number, item: ChipItem) {
  if (item.outlined) {
    doc.roundedRect(x + 0.4, y + 0.4, w - 0.8, CHIP_H - 0.8, 3).lineWidth(0.75).strokeColor("#cbd5e1").stroke();
  } else {
    doc.roundedRect(x, y, w, CHIP_H, 3).fill(CHIP_BG);
  }
  let tx = x + 8;
  if (item.rank) {
    doc.circle(x + 10.5, y + 7, 5.5).fill(NAVY);
    doc.font(F.bold).fontSize(6.5).fillColor("#ffffff").text(String(item.rank), x + 5, y + 3.4, { width: 11, align: "center", lineBreak: false });
    tx = x + 20;
  } else if (item.tick) {
    // Drawn, not typed: this Poppins has no check-mark glyph.
    doc.save().lineWidth(1).strokeColor(NAVY_2).lineCap("round").lineJoin("round");
    doc.moveTo(x + 6, y + 7.2).lineTo(x + 8, y + 9.2).lineTo(x + 11.5, y + 5).stroke();
    doc.restore();
    tx = x + 15;
  }
  doc.font(F.semibold).fontSize(8).fillColor(item.outlined ? INK_2 : NAVY_2).text(item.label, tx, y + 2.4, {
    width: Math.max(10, x + w - tx - 6),
    lineBreak: false,
    ellipsis: true,
  });
}

function answerWidth(doc: Doc, q: QuestionDef, v: AnswerValue): number {
  if (isBlank(v)) return doc.font(F.regular).fontSize(8.5).widthOfString("Not answered");
  switch (q.type) {
    case "yesno":
      return 6 + 9 + 4 + doc.font(F.semibold).fontSize(8).widthOfString(v === "yes" ? "Yes" : "No") + 8;
    case "number":
      return doc.font(F.bold).fontSize(11).widthOfString(formatNumber(q.key, v));
    case "select":
      return doc.font(F.semibold).fontSize(8).widthOfString(String(v)) + 16;
    case "scale":
      return 42 + doc.font(F.medium).fontSize(8).widthOfString(`${v} / 4`);
    default:
      return Math.min(ANSWER_W, doc.font(F.semibold).fontSize(9).widthOfString(String(v)));
  }
}

/** Draws an inline (right-column) answer, right-aligned to `right`, vertically centered on a 14pt line at `y`. */
function drawInlineAnswer(doc: Doc, q: QuestionDef, v: AnswerValue, right: number, y: number) {
  const x = right - answerWidth(doc, q, v);
  if (isBlank(v)) {
    doc.font(F.regular).fontSize(8.5).fillColor(FAINT).text("Not answered", x, y + 2, { lineBreak: false });
    return;
  }
  switch (q.type) {
    case "yesno":
      pill(doc, x, y, v === "yes");
      return;
    case "number":
      doc.font(F.bold).fontSize(11).fillColor(NAVY).text(formatNumber(q.key, v), x, y, { lineBreak: false });
      return;
    case "select":
      chip(doc, x, y, String(v));
      return;
    case "scale":
      scaleDots(doc, x, y, Number(v));
      return;
    default:
      doc.font(F.semibold).fontSize(9).fillColor(TEAL).text(String(v), right - ANSWER_W, y + 1.5, { width: ANSWER_W, align: "right" });
  }
}

/**
 * Draws the Solution Questionnaire PDF. Lives here rather than in the
 * route (as the Vision Board and Status Report do) so the layout can be
 * rendered and looked at without standing up a session.
 *
 * Client-confirmed redesign (2026-09-17): a branded cover page (at-a-glance
 * numbers, Yes answers by section, contents with page numbers, an answer
 * key), then every question as a numbered row with its answer styled by
 * type. Embeds Poppins (lib/pdf/fonts, SIL OFL) to match the app instead of
 * pdfkit's built-in Helvetica. Pages are laid out manually (top/bottom
 * margins of 0) so pdfkit never auto-inserts a page mid-row.
 *
 * Client-confirmed (2026-10-14, "PDF Exports Refresh"): the ICP's five
 * sections follow as Part 2, opening on a fresh page with a summary strip.
 * Contents splits by part, the Yes bars stay Part 1 only (the ICP has no
 * yes/no questions), and tick lists, rankings and the competitor list
 * print as wrapping chips under the question.
 */
export function renderQuestionnaire(doc: Doc, accountName: string, answers: Record<string, AnswerValue>) {
  const exportedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const answeredCount = countAnswered(answers as Record<string, unknown>);

  const yesStats = QUESTIONNAIRE_SECTIONS.map((s) => {
    const yn = s.questions.filter((q) => q.type === "yesno");
    return { total: yn.length, yes: yn.filter((q) => answers[q.key] === "yes").length };
  });

  const heading = (title: string, note: string | null, y: number) => {
    doc.font(F.semibold).fontSize(11).fillColor(NAVY).text(title, M, y, { lineBreak: false });
    if (note) doc.font(F.medium).fontSize(8).fillColor(FAINT).text(note, M, y + 3, { width: CONTENT_W, align: "right", lineBreak: false });
  };

  // ================= Cover =================
  const BAND_H = 200;
  doc.rect(0, 0, PAGE_W, BAND_H).fill(NAVY);
  doc.save();
  doc.rect(0, 0, PAGE_W, BAND_H).clip();
  doc.circle(PAGE_W - 50, 58, 104).lineWidth(28).strokeOpacity(0.18).strokeColor(TEAL_BRIGHT).stroke();
  doc.restore();
  doc.strokeOpacity(1);

  // The mark replaces the typed wordmark on the cover. It sits on a
  // white chip: "Growth" is #113c7b and measures 1.64:1 on this navy.
  drawLogoChip(doc, M, 28);
  doc.font(F.bold).fontSize(26).fillColor("#ffffff").text("GrowthMission Solution Questionnaire", M, 68, { width: 380, lineGap: -4 });
  doc.font(F.regular).fontSize(13).fillColor("#d4dbe6").text(accountName, M, doc.y + 2, { width: 400 });
  const metaY = doc.y + 10;
  let mx = M;
  for (const [label, value] of [
    ["Answered ", `${answeredCount} of ${TOTAL_QUESTION_COUNT}`],
    ["Exported ", exportedOn],
    ["", `${QUESTIONNAIRE_SECTIONS.length} sections`],
  ]) {
    doc.font(F.regular).fontSize(9).fillColor("#9fb0c9");
    doc.text(label, mx, metaY, { lineBreak: false });
    mx += doc.widthOfString(label);
    doc.font(F.semibold).fillColor("#ffffff").text(value, mx, metaY, { lineBreak: false });
    mx += doc.widthOfString(value) + 18;
  }

  // At a glance
  let y = BAND_H + 18;
  heading("At a glance", "From your answers", y);
  y += 20;
  const figW = (CONTENT_W - 16) / 3;
  GLANCE.forEach((g, i) => {
    const fx = M + (i % 3) * (figW + 8);
    const fy = y + Math.floor(i / 3) * 48;
    doc.roundedRect(fx, fy, figW, 40, 5).lineWidth(0.75).strokeColor(RULE).stroke();
    doc.font(F.bold).fontSize(16).fillColor(NAVY).text(formatNumber(g.key, answers[g.key]), fx + 11, fy + 6, { lineBreak: false });
    doc.font(F.regular).fontSize(8).fillColor(MUTED).text(g.label, fx + 11, fy + 26, { lineBreak: false });
  });
  y += 96 + 8;

  // Yes answers by section
  heading("Yes answers by section", "Yes/No questions only", y);
  y += 20;
  const trackX = M + 160;
  const trackW = CONTENT_W - 160 - 62;
  // The ICP has no yes/no questions, so only Part 1's sections get a bar.
  QUESTIONNAIRE_SECTIONS.forEach((s, i) => {
    if (s.part !== "growth") return;
    const st = yesStats[i];
    doc.font(F.regular).fontSize(9).fillColor(INK_2).text(s.name, M, y, { width: 150, lineBreak: false, ellipsis: true });
    doc.roundedRect(trackX, y + 4, trackW, 7, 3.5).lineWidth(0.75).fillAndStroke(ZEBRA, RULE);
    if (st.total > 0 && st.yes > 0) {
      doc.roundedRect(trackX, y + 4, Math.max(7, (trackW * st.yes) / st.total), 7, 3.5).fill(TEAL);
    }
    const count = `${st.yes} of ${st.total}`;
    doc.font(F.regular).fontSize(9).fillColor(MUTED).text(count, M, y, { width: CONTENT_W, align: "right", lineBreak: false });
    y += 16;
  });
  y += 12;

  // Contents (page numbers filled in once the question pages are laid out)
  heading("Contents", null, y);
  y += 20;
  const tocColW = (CONTENT_W - 20) / 2;
  // One column per part (client-confirmed, 2026-10-14).
  const tocSlots: { x: number; y: number; w: number }[] = [];
  let tocRows = 0;
  PARTS.forEach(({ part, label }, col) => {
    const tx = M + col * (tocColW + 20);
    doc.font(F.bold).fontSize(7).fillColor(TEAL).text(label.toUpperCase(), tx, y, { characterSpacing: 0.6, lineBreak: false });
    let rows = 0;
    QUESTIONNAIRE_SECTIONS.forEach((s, i) => {
      if (s.part !== part) return;
      const ty = y + 12 + rows * 16;
      doc.font(F.regular).fontSize(9).fillColor(INK_2).text(`${i + 1}. ${s.name}`, tx, ty, { width: tocColW - 30, lineBreak: false, ellipsis: true });
      doc.moveTo(tx, ty + 14).lineTo(tx + tocColW, ty + 14).lineWidth(0.5).dash(1, { space: 2 }).strokeColor(RULE).stroke().undash();
      tocSlots[i] = { x: tx, y: ty, w: tocColW };
      rows++;
    });
    tocRows = Math.max(tocRows, rows);
  });
  y += 12 + tocRows * 16 + 14;

  // Answer key
  heading("How answers are shown", null, y);
  y += 20;
  let lx = M;
  const gap = 10;
  lx += pill(doc, lx, y, true) + gap;
  lx += pill(doc, lx, y, false) + gap;
  doc.font(F.bold).fontSize(10).fillColor(NAVY).text("42", lx, y + 0.5, { lineBreak: false });
  lx += doc.widthOfString("42") + 4;
  doc.font(F.regular).fontSize(8).fillColor(MUTED).text("number", lx, y + 2.6, { lineBreak: false });
  lx += doc.widthOfString("number") + gap;
  lx += scaleDots(doc, lx, y, 3) + 4;
  doc.font(F.regular).fontSize(8).fillColor(MUTED).text("scale", lx, y + 2.6, { lineBreak: false });
  lx += doc.widthOfString("scale") + gap;
  lx += chip(doc, lx, y, "Both") + 4;
  doc.font(F.regular).fontSize(8).fillColor(MUTED).text("choice", lx, y + 2.6, { lineBreak: false });
  lx += doc.widthOfString("choice") + gap;
  // Second row: the answer types the ICP added (2026-10-14), so the key fits the page width.
  lx = M;
  y += 20;
  for (const [item, word] of [
    [{ label: "SMB", tick: true }, "ticked"],
    [{ label: "Legal", rank: 1 }, "ranked"],
  ] as [ChipItem, string][]) {
    const w = chipWidth(doc, item, 200);
    drawChipItem(doc, lx, y, w, item);
    lx += w + 4;
    doc.font(F.regular).fontSize(8).fillColor(MUTED).text(word, lx, y + 2.6, { lineBreak: false });
    lx += doc.widthOfString(word) + gap;
  }
  doc.font(F.semibold).fontSize(9).fillColor(TEAL).text("Free text", lx, y + 1.5, { lineBreak: false });
  lx += doc.widthOfString("Free text") + gap;
  doc.font(F.regular).fontSize(8.5).fillColor(FAINT).text("Not answered", lx, y + 2, { lineBreak: false });

  // ================= Question pages =================
  const sectionStartPage: number[] = [];
  let questionNumber = 0;
  y = BODY_BOTTOM + 1; // forces a new page for the first section

  const newPage = () => {
    doc.addPage();
    y = BODY_TOP;
  };

  const SECTION_HEADER_H = 36;
  const drawSectionHeader = (index: number, continued: boolean) => {
    const s = QUESTIONNAIRE_SECTIONS[index];
    const st = yesStats[index];
    const top = y + 6;
    doc.roundedRect(M, top, 22, 22, 5).fill(NAVY);
    doc.font(F.bold).fontSize(10).fillColor("#ffffff").text(String(index + 1), M, top + 5, { width: 22, align: "center", lineBreak: false });
    doc.font(F.semibold).fontSize(13).fillColor(NAVY).text(s.name, M + 31, top + 2.5, { lineBreak: false });
    if (continued) {
      const tw = doc.widthOfString(s.name);
      doc.font(F.medium).fontSize(8).fillColor(FAINT).text("continued", M + 31 + tw + 6, top + 7.5, { lineBreak: false });
    }
    const stats = `${s.questions.length} ${s.questions.length === 1 ? "question" : "questions"}${st.total ? ` · ${st.yes} of ${st.total} Yes` : ""}`;
    doc.font(F.regular).fontSize(8).fillColor(MUTED).text(stats, M, top + 7, { width: CONTENT_W, align: "right", lineBreak: false });
    doc.moveTo(M, y + SECTION_HEADER_H - 1).lineTo(M + CONTENT_W, y + SECTION_HEADER_H - 1).lineWidth(1.5).strokeColor(NAVY).stroke();
    y += SECTION_HEADER_H + 2;
  };

  const WIDE_W = CONTENT_W - ROW_PAD * 2 - NUM_W - 8;

  /**
   * Part 2 opens on its own page with a navy strip summarising the ICP
   * (client-confirmed, 2026-10-14, "PDF Exports Refresh"). Unanswered facts
   * are left out, the same rule the Vision Board export follows.
   */
  const drawPartOpener = () => {
    const ranked = arrayAnswer(answers.icp_industries).map((v, i) => `${i + 1} ${v}`).join(" · ");
    const sizes = arrayAnswer(answers.icp_company_size);
    const facts = [
      ["Top industries", ranked],
      ["Company size", sizes.length ? `${sizes.join(", ")} employees` : ""],
      ["Coverage area", typeof answers.icp_locations === "string" ? answers.icp_locations.trim() : ""],
    ].filter(([, value]) => value) as [string, string][];
    const top = y + 4;
    const h = facts.length > 0 ? 68 : 46;
    const g = doc.linearGradient(M, top, M + CONTENT_W, top + h);
    g.stop(0, NAVY).stop(1, "#056a80");
    doc.roundedRect(M, top, CONTENT_W, h, 6).fill(g);
    doc.font(F.bold).fontSize(7).fillColor("#95dfee").text("PART 2 OF 2", M + 14, top + 11, { characterSpacing: 0.8, lineBreak: false });
    doc.font(F.bold).fontSize(14).fillColor("#ffffff").text("Ideal Customer Profile", M + 14, top + 21, { lineBreak: false });
    const colW = (CONTENT_W - 28) / 3;
    facts.forEach(([label, value], i) => {
      const fx = M + 14 + i * colW;
      doc.font(F.regular).fontSize(7).fillColor("#9fb0c9").text(label, fx, top + 43, { width: colW - 10, lineBreak: false });
      doc.font(F.semibold).fontSize(8.5).fillColor("#ffffff").text(value, fx, top + 52, { width: colW - 10, height: 11, ellipsis: true });
    });
    y = top + h + 8;
  };

  QUESTIONNAIRE_SECTIONS.forEach((section, si) => {
    let rowIndex = 0;
    if (section.part === "icp" && QUESTIONNAIRE_SECTIONS[si - 1]?.part === "growth") {
      newPage();
      drawPartOpener();
    }
    section.questions.forEach((q, qi) => {
      questionNumber++;
      const v = answers[q.key];
      const chips = isChipType(q) ? chipItems(q, answers) : [];
      const label = q.type === "rank" ? `${q.label} (ranked 1–${q.max ?? 3}, 1 = greatest)` : q.label;
      const isWide = chips.length > 0 || (q.type === "text" && !isBlank(v) && String(v).length > WIDE_TEXT_THRESHOLD);

      doc.font(F.regular).fontSize(9);
      const questionH = doc.heightOfString(label, { width: isWide ? WIDE_W : QUESTION_W, lineGap: 1 });
      let answerH = 0;
      if (chips.length > 0) {
        answerH = layoutChips(doc, chips, WIDE_W).height + 4;
      } else if (isWide) {
        doc.font(F.semibold).fontSize(9);
        answerH = doc.heightOfString(String(v), { width: WIDE_W, lineGap: 1 }) + 2;
      }
      const rowH = (isWide ? questionH + answerH : Math.max(questionH, 14)) + ROW_PAD * 2;

      const needsHeader = qi === 0;
      const required = rowH + (needsHeader ? SECTION_HEADER_H + 2 : 0);
      if (y + required > BODY_BOTTOM) {
        newPage();
        if (!needsHeader) {
          drawSectionHeader(si, true);
          rowIndex = 0;
        }
      }
      if (needsHeader) {
        drawSectionHeader(si, false);
        sectionStartPage[si] = doc.bufferedPageRange().count;
      }

      if (rowIndex % 2 === 1) doc.rect(M, y, CONTENT_W, rowH).fill(ZEBRA);
      doc.moveTo(M, y + rowH).lineTo(M + CONTENT_W, y + rowH).lineWidth(0.5).strokeColor(ROW_RULE).stroke();

      const innerTop = y + ROW_PAD;
      const lineCenterTop = isWide ? innerTop : innerTop + (Math.max(questionH, 14) - 14) / 2;
      doc.font(F.regular).fontSize(7.5).fillColor(FAINT).text(String(questionNumber), M + ROW_PAD, lineCenterTop + 2.5, { width: NUM_W, lineBreak: false });
      const qx = M + ROW_PAD + NUM_W + 8;
      const questionTop = isWide ? innerTop : innerTop + (Math.max(questionH, 14) - questionH) / 2;
      doc.font(F.regular).fontSize(9).fillColor(INK).text(label, qx, questionTop, {
        width: isWide ? CONTENT_W - ROW_PAD * 2 - NUM_W - 8 : QUESTION_W,
        lineGap: 1,
      });

      if (chips.length > 0) {
        for (const at of layoutChips(doc, chips, WIDE_W).placed) {
          drawChipItem(doc, qx + at.x, innerTop + questionH + 4 + at.y, at.w, at.item);
        }
      } else if (isWide) {
        doc.font(F.semibold).fontSize(9).fillColor(TEAL).text(String(v), qx, innerTop + questionH + 2, {
          width: CONTENT_W - ROW_PAD * 2 - NUM_W - 8,
          lineGap: 1,
        });
      } else {
        drawInlineAnswer(doc, q, v, M + CONTENT_W - ROW_PAD, lineCenterTop);
      }

      y += rowH;
      rowIndex++;
    });
    y += 10;
  });

  // ================= Running header, footer, contents page numbers =================
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageNo = i - range.start + 1;
    if (pageNo > 1) {
      // A white page here, so the mark goes on directly — no chip needed.
      const bw = drawLogo(doc, M, 21, 70).width;
      doc.font(F.regular).fontSize(8).fillColor(FAINT).text("·  SOLUTION QUESTIONNAIRE", M + bw + 4, 24, { characterSpacing: 0.4, lineBreak: false });
      doc.text(accountName.toUpperCase(), M, 24, { width: CONTENT_W, align: "right", characterSpacing: 0.4, lineBreak: false });
    }
    doc.moveTo(M, PAGE_H - 40).lineTo(M + CONTENT_W, PAGE_H - 40).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font(F.regular).fontSize(7.5).fillColor(FAINT);
    doc.text(`GrowthMission Solution Questionnaire · ${accountName} · Exported ${exportedOn}`, M, PAGE_H - 32, { width: CONTENT_W - 80, lineBreak: false, ellipsis: true });
    doc.text(`Page ${pageNo} of ${range.count}`, M, PAGE_H - 32, { width: CONTENT_W, align: "right", lineBreak: false });
  }

  doc.switchToPage(range.start);
  tocSlots.forEach((slot, i) => {
    doc.font(F.regular).fontSize(9).fillColor(FAINT).text(`p. ${sectionStartPage[i] ?? "—"}`, slot.x, slot.y, { width: slot.w, align: "right", lineBreak: false });
  });

}
