import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { POPPINS, registerPoppins } from "@/lib/pdf/poppins";
import { QUESTIONNAIRE_SECTIONS, TOTAL_QUESTION_COUNT, countAnswered, type QuestionDef } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";

type Doc = InstanceType<typeof PDFDocument>;
type AnswerValue = string | number | null | undefined;

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
const CONTENT_W = PAGE_W - M * 2;
const BODY_TOP = 58;
const BODY_BOTTOM = PAGE_H - 52;
const ANSWER_W = 136;
const NUM_W = 18;
const ROW_PAD = 6;
const QUESTION_W = CONTENT_W - ROW_PAD * 2 - NUM_W - 8 - ANSWER_W - 8;
const WIDE_TEXT_THRESHOLD = 28;

const F = POPPINS;

const GLANCE: { key: string; label: string }[] = [
  { key: "overview_employees", label: "Employees" },
  { key: "overview_locations", label: "Locations" },
  { key: "sales_team_count", label: "Sales professionals" },
  { key: "strategy_average_mrr", label: "Avg. MRR per agreement" },
  { key: "strategy_deals_per_month", label: "Deals closed per month" },
  { key: "leadgen_mql_count", label: "MQLs" },
];

const isBlank = (v: AnswerValue) => v === null || v === undefined || v === "";

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
 * Backend Schema §10 — GET /api/questionnaire/export. Session (any role with
 * RLS read access to growth_questionnaire_responses — the regular server
 * client is enough, no service role involved).
 *
 * Client-confirmed redesign (2026-09-17): a branded cover page (at-a-glance
 * numbers, Yes answers by section, contents with page numbers, an answer
 * key), then every question as a numbered row with its answer styled by
 * type. Embeds Poppins (lib/pdf/fonts, SIL OFL) to match the app instead of
 * pdfkit's built-in Helvetica. Pages are laid out manually (top/bottom
 * margins of 0) so pdfkit never auto-inserts a page mid-row.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing account_id." }, { status: 400 });
  }

  const [{ data: response }, { data: account }] = await Promise.all([
    supabase.from("growth_questionnaire_responses").select("answers").eq("account_id", accountId).maybeSingle(),
    supabase.from("accounts").select("name").eq("id", accountId).maybeSingle(),
  ]);

  if (!response) {
    return NextResponse.json({ error: "No questionnaire responses found for this account." }, { status: 404 });
  }

  const answers = (response.answers ?? {}) as Record<string, AnswerValue>;
  const accountName = account?.name ?? "GrowthOS Account";
  const exportedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const answeredCount = countAnswered(answers as Record<string, unknown>);

  const doc = new PDFDocument({ size: "LETTER", margins: { top: 0, bottom: 0, left: M, right: M }, bufferPages: true });
  registerPoppins(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const yesStats = QUESTIONNAIRE_SECTIONS.map((s) => {
    const yn = s.questions.filter((q) => q.type === "yesno");
    return { total: yn.length, yes: yn.filter((q) => answers[q.key] === "yes").length };
  });

  const heading = (title: string, note: string | null, y: number) => {
    doc.font(F.semibold).fontSize(11).fillColor(NAVY).text(title, M, y, { lineBreak: false });
    if (note) doc.font(F.medium).fontSize(8).fillColor(FAINT).text(note, M, y + 3, { width: CONTENT_W, align: "right", lineBreak: false });
  };

  // ================= Cover =================
  const BAND_H = 180;
  doc.rect(0, 0, PAGE_W, BAND_H).fill(NAVY);
  doc.save();
  doc.rect(0, 0, PAGE_W, BAND_H).clip();
  doc.circle(PAGE_W - 50, 58, 104).lineWidth(28).strokeOpacity(0.18).strokeColor(TEAL_BRIGHT).stroke();
  doc.restore();
  doc.strokeOpacity(1);

  doc.font(F.bold).fontSize(9).fillColor(TEAL_BRIGHT).text("GROWTHOS", M, 34, { characterSpacing: 1.3, lineBreak: false });
  doc.font(F.bold).fontSize(26).fillColor("#ffffff").text("GOS Solution Questionnaire", M, 50, { width: 380, lineGap: -4 });
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
  let y = BAND_H + 22;
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
  y += 96 + 12;

  // Yes answers by section
  heading("Yes answers by section", "Yes/No questions only", y);
  y += 20;
  const trackX = M + 160;
  const trackW = CONTENT_W - 160 - 62;
  QUESTIONNAIRE_SECTIONS.forEach((s, i) => {
    const st = yesStats[i];
    doc.font(F.regular).fontSize(9).fillColor(INK_2).text(s.name, M, y, { width: 150, lineBreak: false, ellipsis: true });
    doc.roundedRect(trackX, y + 4, trackW, 7, 3.5).lineWidth(0.75).fillAndStroke(ZEBRA, RULE);
    if (st.total > 0 && st.yes > 0) {
      doc.roundedRect(trackX, y + 4, Math.max(7, (trackW * st.yes) / st.total), 7, 3.5).fill(TEAL);
    }
    const count = `${st.yes} of ${st.total}`;
    doc.font(F.regular).fontSize(9).fillColor(MUTED).text(count, M, y, { width: CONTENT_W, align: "right", lineBreak: false });
    y += 17;
  });
  y += 12;

  // Contents (page numbers filled in once the question pages are laid out)
  heading("Contents", null, y);
  y += 20;
  const tocColW = (CONTENT_W - 20) / 2;
  const tocSlots = QUESTIONNAIRE_SECTIONS.map((s, i) => {
    const tx = M + (i % 2) * (tocColW + 20);
    const ty = y + Math.floor(i / 2) * 17;
    doc.font(F.regular).fontSize(9).fillColor(INK_2).text(`${i + 1}. ${s.name}`, tx, ty, { width: tocColW - 30, lineBreak: false, ellipsis: true });
    doc.moveTo(tx, ty + 14).lineTo(tx + tocColW, ty + 14).lineWidth(0.5).dash(1, { space: 2 }).strokeColor(RULE).stroke().undash();
    return { x: tx, y: ty, w: tocColW };
  });
  y += Math.ceil(QUESTIONNAIRE_SECTIONS.length / 2) * 17 + 14;

  // Answer key
  heading("How answers are shown", null, y);
  y += 20;
  let lx = M;
  const gap = 14;
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
    const stats = `${s.questions.length} questions${st.total ? ` · ${st.yes} of ${st.total} Yes` : ""}`;
    doc.font(F.regular).fontSize(8).fillColor(MUTED).text(stats, M, top + 7, { width: CONTENT_W, align: "right", lineBreak: false });
    doc.moveTo(M, y + SECTION_HEADER_H - 1).lineTo(M + CONTENT_W, y + SECTION_HEADER_H - 1).lineWidth(1.5).strokeColor(NAVY).stroke();
    y += SECTION_HEADER_H + 2;
  };

  QUESTIONNAIRE_SECTIONS.forEach((section, si) => {
    let rowIndex = 0;
    section.questions.forEach((q, qi) => {
      questionNumber++;
      const v = answers[q.key];
      const isWide = q.type === "text" && !isBlank(v) && String(v).length > WIDE_TEXT_THRESHOLD;

      doc.font(F.regular).fontSize(9);
      const questionH = doc.heightOfString(q.label, { width: isWide ? CONTENT_W - ROW_PAD * 2 - NUM_W - 8 : QUESTION_W, lineGap: 1 });
      let answerH = 0;
      if (isWide) {
        doc.font(F.semibold).fontSize(9);
        answerH = doc.heightOfString(String(v), { width: CONTENT_W - ROW_PAD * 2 - NUM_W - 8, lineGap: 1 }) + 2;
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
      doc.font(F.regular).fontSize(9).fillColor(INK).text(q.label, qx, questionTop, {
        width: isWide ? CONTENT_W - ROW_PAD * 2 - NUM_W - 8 : QUESTION_W,
        lineGap: 1,
      });

      if (isWide) {
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
      doc.font(F.bold).fontSize(8).fillColor(TEAL).text("GROWTHOS", M, 24, { characterSpacing: 0.4, lineBreak: false });
      const bw = doc.widthOfString("GROWTHOS") + 8 * 0.4;
      doc.font(F.regular).fontSize(8).fillColor(FAINT).text("·  SOLUTION QUESTIONNAIRE", M + bw + 4, 24, { characterSpacing: 0.4, lineBreak: false });
      doc.text(accountName.toUpperCase(), M, 24, { width: CONTENT_W, align: "right", characterSpacing: 0.4, lineBreak: false });
    }
    doc.moveTo(M, PAGE_H - 40).lineTo(M + CONTENT_W, PAGE_H - 40).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font(F.regular).fontSize(7.5).fillColor(FAINT);
    doc.text(`GOS Solution Questionnaire · ${accountName} · Exported ${exportedOn}`, M, PAGE_H - 32, { width: CONTENT_W - 80, lineBreak: false, ellipsis: true });
    doc.text(`Page ${pageNo} of ${range.count}`, M, PAGE_H - 32, { width: CONTENT_W, align: "right", lineBreak: false });
  }

  doc.switchToPage(range.start);
  tocSlots.forEach((slot, i) => {
    doc.font(F.regular).fontSize(9).fillColor(FAINT).text(`p. ${sectionStartPage[i] ?? "—"}`, slot.x, slot.y, { width: slot.w, align: "right", lineBreak: false });
  });

  doc.end();
  const buffer = await done;
  const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gos-solution-questionnaire-${slug}.pdf"`,
    },
  });
}
