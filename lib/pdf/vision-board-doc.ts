import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";

export type VisionAnswers = Record<string, string | string[] | null>;

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const NAVY_800 = "#133972";
const NAVY_700 = "#113c7b";
const TEAL_800 = "#056a80";
const TEAL_700 = "#028eab";
const TEAL_500 = "#03b8de";
const TEAL_300 = "#95dfee";
const TEAL_200 = "#c6e9f0";
const TEAL_100 = "#e5f2f5";
const WARNING = "#ffde00";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const TINT = "#f8fafc";
const WHITE = "#ffffff";

const M = 54;

type Tone = "white" | "tint" | "navy" | "deep";

const GROUND: Record<Tone, string> = {
  white: WHITE,
  tint: TINT,
  navy: NAVY_900,
  deep: NAVY_950,
};
const ON_GROUND: Record<Tone, { heading: string; body: string; eyebrow: string; faint: string }> = {
  white: { heading: NAVY_900, body: INK, eyebrow: TEAL_700, faint: FAINT },
  tint: { heading: NAVY_900, body: INK, eyebrow: TEAL_700, faint: FAINT },
  navy: { heading: WHITE, body: WHITE, eyebrow: TEAL_300, faint: "#8fa3c4" },
  deep: { heading: WHITE, body: WHITE, eyebrow: TEAL_300, faint: "#8fa3c4" },
};

/**
 * Draws the Vision Board PDF (client-confirmed, 2026-09-22): the same
 * narrative, in the same order, as the Vision Page on screen, rather than
 * the section-by-section report it replaced. Unanswered fields are
 * omitted rather than printed as "Not answered" - a document meant to be
 * shown to people should not be a list of gaps.
 *
 * Each section paints the whole page as its ground and starts on a fresh
 * page, which is what stops a dark band splitting across a page break -
 * the one structural difference from the web page, where bands flow.
 * `section()` and `ensure()` are the whole mechanism: ensure() repaints
 * the same ground when content runs over onto another page.
 *
 * It lives here rather than inside the route so the layout can be
 * rendered and looked at directly, without standing up a session.
 */
export function renderVisionBoard(
  doc: InstanceType<typeof PDFDocument>,
  name: string,
  answers: VisionAnswers,
  /** The account logo, already fetched. Omitted if it could not be read. */
  logo?: Buffer
) {
  const t = (key: string) => {
    const v = answers[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const l = (key: string) => {
    const v = answers[key];
    return Array.isArray(v) ? v.filter((i) => i.trim()) : [];
  };

  const W = doc.page.width;
  const H = doc.page.height;
  const CW = W - M * 2;

  let tone: Tone = "white";
  let firstPage = true;

  const paint = () => {
    doc.rect(0, 0, W, H).fill(GROUND[tone]);
  };

  /** Starts a section: its own page, painted as its ground. */
  const section = (next: Tone) => {
    tone = next;
    if (!firstPage) doc.addPage();
    firstPage = false;
    paint();
    doc.x = M;
    doc.y = M + 16;
  };

  /** Continues onto another page of the same ground when space runs out. */
  const ensure = (space: number) => {
    if (doc.y + space <= H - M - 24) return;
    doc.addPage();
    paint();
    doc.x = M;
    doc.y = M + 16;
  };

  const eyebrow = (value: string, align: "left" | "center" = "left") => {
    ensure(26);
    doc
      .font(POPPINS.semibold)
      .fontSize(7.5)
      .fillColor(ON_GROUND[tone].eyebrow)
      .text(value.toUpperCase(), M, doc.y, { width: CW, characterSpacing: 1.1, align });
    doc.moveDown(0.5);
  };

  const heading = (value: string, size = 21) => {
    ensure(size * 2);
    doc
      .font(POPPINS.bold)
      .fontSize(size)
      .fillColor(ON_GROUND[tone].heading)
      .text(value, M, doc.y, { width: CW * 0.82, lineGap: 2 });
    doc.moveDown(0.6);
  };

  const paragraph = (value: string, size = 11, color?: string) => {
    ensure(size * 3);
    doc
      .font(POPPINS.regular)
      .fontSize(size)
      .fillColor(color ?? ON_GROUND[tone].body)
      .text(value, M, doc.y, { width: CW * 0.84, lineGap: 3 });
    doc.moveDown(0.6);
  };

  const rule = () => {
    ensure(20);
    doc
      .moveTo(M, doc.y)
      .lineTo(M + CW, doc.y)
      .lineWidth(0.6)
      .strokeColor(tone === "navy" || tone === "deep" ? "#2b3d5c" : RULE)
      .stroke();
    doc.moveDown(0.9);
  };

  // ============================ COVER ============================
  const target10 = t("target10_text");
  const signName = t("signoff_name");
  const signTitle = t("signoff_title");
  const signDate = t("signoff_date");

  section("deep");
  // The Aurora wash from the web hero, as two radial gradients.
  const g1 = doc.radialGradient(W * 0.78, H * 0.08, 0, W * 0.78, H * 0.08, W * 0.62);
  g1.stop(0, TEAL_500, 0.55).stop(1, NAVY_950, 0);
  doc.rect(0, 0, W, H).fill(g1);
  const g2 = doc.radialGradient(W * 0.12, H * 0.92, 0, W * 0.12, H * 0.92, W * 0.55);
  g2.stop(0, "#2873e1", 0.45).stop(1, NAVY_950, 0);
  doc.rect(0, 0, W, H).fill(g2);

  // The publisher mark, top-centre, on a white chip: this cover is a
  // dark gradient and half the wordmark is #113c7b (Design System §2).
  // The lockup below it is the *account's* own logo, which is a
  // different thing and stays as it is.
  drawLogoChip(doc, (W - 122) / 2, 46);

  // Centred mark-beside-name lockup, matching the page's hero
  // (client-confirmed mockups "C" and "A").
  const MARK = 46;
  const GAP = 14;
  doc.font(POPPINS.bold).fontSize(17);
  const nameW = doc.widthOfString(name);
  const lockW = (logo ? MARK + GAP : 0) + nameW;
  const lockX = (W - lockW) / 2;
  const lockY = 146;

  if (logo) {
    doc.roundedRect(lockX, lockY, MARK, MARK, 9).fill(WHITE);
    try {
      doc.image(logo, lockX + 5, lockY + 5, { fit: [MARK - 10, MARK - 10], align: "center", valign: "center" });
    } catch {
      // A logo pdfkit cannot decode (an SVG, say) simply leaves the plate
      // blank rather than failing the whole export.
    }
  }

  const textX = lockX + (logo ? MARK + GAP : 0);
  doc.font(POPPINS.bold).fontSize(17).fillColor(WHITE).text(name, textX, lockY + 8, { lineBreak: false });
  doc
    .font(POPPINS.semibold)
    .fontSize(7.5)
    .fillColor("#8fa3c4")
    .text("VISION BOARD", textX, lockY + 30, { characterSpacing: 1.3, lineBreak: false });

  doc.y = 250;
  eyebrow(`Where ${name} is going — ten years out`, "center");
  if (target10) {
    doc
      .font(POPPINS.semibold)
      .fontSize(27)
      .fillColor(WHITE)
      .text(target10, M + CW * 0.08, doc.y, { width: CW * 0.84, lineGap: 7, align: "center" });
    doc.moveDown(1.2);
  }
  const credit = [signName, signTitle, signDate].filter(Boolean).join("  ·  ");
  if (credit) {
    doc.font(POPPINS.regular).fontSize(9.5).fillColor("#8fa3c4").text(credit, M, doc.y, { width: CW, align: "center" });
  }

  // ======================= PURPOSE & NICHE =======================
  const purpose = t("focus_purpose");
  const niche = t("focus_niche");
  if (purpose || niche) {
    section("white");
    // Label in a narrow rail on the left, statement to its right - the
    // page's "B" treatment, so both read the same way.
    const RAIL = 132;
    const STATEMENT_X = M + RAIL + 26;
    const STATEMENT_W = CW - RAIL - 26;

    const railLabel = (label: string, y: number) => {
      doc.moveTo(M, y).lineTo(M + RAIL, y).lineWidth(2).strokeColor(TEAL_500).stroke();
      doc
        .font(POPPINS.semibold)
        .fontSize(7.5)
        .fillColor(TEAL_700)
        .text(label.toUpperCase(), M, y + 10, { width: RAIL, characterSpacing: 1.1 });
    };

    if (purpose) {
      const top = doc.y;
      railLabel(`${name} exists to`, top);
      doc
        .font(POPPINS.regular)
        .fontSize(12)
        .fillColor(INK)
        .text(purpose, STATEMENT_X, top - 2, { width: STATEMENT_W, lineGap: 3.5 });
      doc.y = Math.max(doc.y, top + 46) + 26;
    }
    if (niche) {
      if (purpose) rule();
      const top = doc.y;
      railLabel("And does this better than most", top);
      doc
        .font(POPPINS.regular)
        .fontSize(12)
        .fillColor(INK)
        .text(niche, STATEMENT_X, top - 2, { width: STATEMENT_W, lineGap: 3.5 });
      doc.y = Math.max(doc.y, top + 46);
    }
  }

  // =========================== VALUES ============================
  const values = l("values_list");
  if (values.length > 0) {
    section("navy");
    eyebrow(`What ${name} will not compromise`);
    heading("Core values");

    const gap = 12;
    const perRow = 3;
    const cardW = (CW - gap * (perRow - 1)) / perRow;
    const cardH = 104;
    const gradients: [string, string][] = [
      [NAVY_800, NAVY_900],
      [TEAL_800, NAVY_900],
      [NAVY_700, TEAL_800],
    ];
    let top = doc.y + 4;
    values.forEach((value, i) => {
      const col = i % perRow;
      if (col === 0 && i > 0) top += cardH + gap;
      if (top + cardH > H - M - 24) {
        doc.addPage();
        paint();
        top = M + 16;
      }
      const x = M + col * (cardW + gap);
      const [from, to] = gradients[i % gradients.length];
      const cg = doc.linearGradient(x, top, x + cardW, top + cardH);
      cg.stop(0, from).stop(1, to);
      doc.roundedRect(x, top, cardW, cardH, 11).fill(cg);
      doc
        .font(POPPINS.bold)
        .fontSize(7.5)
        .fillColor(TEAL_300)
        .text(String(i + 1).padStart(2, "0"), x + 18, top + cardH - 46, { width: cardW - 36, characterSpacing: 1.2 });
      doc
        .font(POPPINS.bold)
        .fontSize(14)
        .fillColor(WHITE)
        .text(value, x + 18, top + cardH - 34, { width: cardW - 30, lineGap: 1 });
    });
    doc.y = top + cardH + 16;
  }

  // ========================= 3-YEAR PICTURE =======================
  const figures3 = [
    ["Revenue", t("picture3_revenue")],
    ["Gross profit", t("picture3_gross_profit")],
    ["Net profit", t("picture3_net_profit")],
    ["MRR", t("picture3_mrr")],
  ].filter(([, v]) => v) as [string, string][];
  const picture3 = [
    ["The team", t("picture3_team")],
    ["The clients", t("picture3_clients")],
    ["The market position", t("picture3_market_position")],
    ["Operations", t("picture3_operations")],
  ].filter(([, v]) => v) as [string, string][];

  if (figures3.length > 0 || picture3.length > 0) {
    section("deep");
    eyebrow("Three years from today");
    heading(`This is what ${name} looks like.`);

    if (figures3.length > 0) {
      const colW = CW / figures3.length;
      const top = doc.y + 6;
      const boxH = 62;
      doc.moveTo(M, top).lineTo(M + CW, top).lineWidth(0.6).strokeColor("#2b3d5c").stroke();
      figures3.forEach(([k, v], i) => {
        const x = M + i * colW;
        if (i > 0) {
          doc.moveTo(x, top).lineTo(x, top + boxH).lineWidth(0.6).strokeColor("#2b3d5c").stroke();
        }
        doc
          .font(POPPINS.semibold)
          .fontSize(7)
          .fillColor("#8fa3c4")
          .text(k.toUpperCase(), x + 12, top + 14, { width: colW - 20, characterSpacing: 0.9 });
        doc
          .font(POPPINS.bold)
          .fontSize(20)
          .fillColor(i === 0 ? TEAL_300 : WHITE)
          .text(v, x + 12, top + 28, { width: colW - 20, lineBreak: false });
      });
      doc.moveTo(M, top + boxH).lineTo(M + CW, top + boxH).lineWidth(0.6).strokeColor("#2b3d5c").stroke();
      doc.y = top + boxH + 22;
    }

    picture3.forEach(([k, v]) => {
      ensure(56);
      doc
        .font(POPPINS.semibold)
        .fontSize(7)
        .fillColor("#8fa3c4")
        .text(k.toUpperCase(), M, doc.y, { width: CW, characterSpacing: 0.9 });
      doc.moveDown(0.25);
      doc.font(POPPINS.regular).fontSize(11).fillColor("#e6edf7").text(v, M, doc.y, { width: CW * 0.84, lineGap: 3 });
      doc.moveDown(0.7);
    });
  }

  // ========================== 1-YEAR PLAN =========================
  const goals1 = [
    ["Revenue goal", t("plan1_revenue_goal")],
    ["Gross profit", t("plan1_gross_profit_goal")],
    ["Net profit", t("plan1_net_profit_goal")],
    ["MRR goal", t("plan1_mrr_goal")],
    ["New client acquisition", t("plan1_new_client_goal")],
  ].filter(([, v]) => v) as [string, string][];
  const priorities = l("plan1_priorities");

  if (goals1.length > 0 || priorities.length > 0) {
    section("white");
    eyebrow("The next twelve months");
    heading("What has to be true a year from now.");

    if (goals1.length > 0) {
      const gap = 10;
      const perRow = 3;
      const boxW = (CW - gap * (perRow - 1)) / perRow;
      const innerW = boxW - 24;

      /**
       * These "stats" are free-text questionnaire answers, so one of them
       * is routinely a sentence rather than a figure — "40 new clients, 30
       * of them in regulated industries". At a fixed 15pt that overflowed
       * its card and collided with the Priorities list underneath; the
       * `ellipsis` option did not save it, and truncating a goal to "40 new
       * clients, 30 of…" would lose the half that matters.
       *
       * So each value picks the largest size at which it fits the card, and
       * every row is as tall as its tallest card. A figure still reads as a
       * figure; a sentence wraps and stays inside its box.
       */
      const fitted = goals1.map(([k, v]) => {
        for (const size of [15, 13, 11, 9.5]) {
          doc.font(POPPINS.bold).fontSize(size);
          const h = doc.heightOfString(v, { width: innerW });
          if (h <= 46 || size === 9.5) return { k, v, size, h };
        }
        return { k, v, size: 9.5, h: 46 };
      });

      const rows = Math.ceil(fitted.length / perRow);
      const rowH: number[] = [];
      for (let r = 0; r < rows; r++) {
        const tallest = Math.max(
          ...fitted.slice(r * perRow, r * perRow + perRow).map((f) => f.h)
        );
        rowH.push(Math.max(54, tallest + 34));
      }

      let top = doc.y + 4;
      fitted.forEach((f, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        if (col === 0 && i > 0) top += rowH[row - 1] + gap;
        const x = M + col * (boxW + gap);
        doc.roundedRect(x, top, boxW, rowH[row], 9).lineWidth(0.8).strokeColor(RULE).stroke();
        doc
          .font(POPPINS.semibold)
          .fontSize(7)
          .fillColor(FAINT)
          .text(f.k.toUpperCase(), x + 12, top + 12, { width: innerW, characterSpacing: 0.7, lineBreak: false, ellipsis: true });
        doc
          .font(POPPINS.bold)
          .fontSize(f.size)
          .fillColor(NAVY_900)
          .text(f.v, x + 12, top + 26, { width: innerW });
      });
      doc.y = top + rowH[rows - 1] + 24;
    }

    if (priorities.length > 0) {
      eyebrow("Priorities");
      priorities.forEach((p, i) => {
        ensure(34);
        const y = doc.y;
        doc
          .font(POPPINS.bold)
          .fontSize(8)
          .fillColor(TEAL_700)
          .text(String(i + 1).padStart(2, "0"), M, y + 3, { width: 22, characterSpacing: 0.6 });
        doc.font(POPPINS.medium).fontSize(12).fillColor(INK).text(p, M + 26, y, { width: CW - 26, lineGap: 2 });
        doc.moveDown(0.4);
        doc
          .moveTo(M, doc.y)
          .lineTo(M + CW, doc.y)
          .lineWidth(0.6)
          .strokeColor(RULE)
          .stroke();
        doc.moveDown(0.5);
      });
    }
  }

  // ========================= THE DIFFERENCE ========================
  const uniques = [t("unique_1"), t("unique_2"), t("unique_3")].filter(Boolean) as string[];
  const guarantee = t("guarantee_text");
  const journey = l("process_stages");

  if (uniques.length > 0 || guarantee || journey.length > 0) {
    section("tint");
    eyebrow(`Why clients choose ${name}`);
    heading(`The ${name} difference`);

    if (uniques.length > 0) {
      const gap = 16;
      const colW = (CW - gap * (uniques.length - 1)) / uniques.length;
      const top = doc.y + 4;
      let tallest = 0;
      uniques.forEach((u, i) => {
        const x = M + i * (colW + gap);
        doc.moveTo(x, top).lineTo(x + colW, top).lineWidth(2.5).strokeColor(TEAL_500).stroke();
        doc
          .font(POPPINS.bold)
          .fontSize(7)
          .fillColor(TEAL_700)
          .text(`UNIQUE ${String(i + 1).padStart(2, "0")}`, x, top + 12, { width: colW, characterSpacing: 1.2 });
        doc.font(POPPINS.medium).fontSize(11).fillColor(INK).text(u, x, top + 26, { width: colW, lineGap: 2.5 });
        tallest = Math.max(tallest, doc.y - top);
      });
      doc.y = top + tallest + 22;
    }

    if (guarantee) {
      doc.font(POPPINS.bold).fontSize(15);
      const qh = doc.heightOfString(guarantee, { width: CW - 56, lineGap: 3 }) + 54;
      ensure(qh + 10);
      const top = doc.y;
      const qg = doc.linearGradient(M, top, M + CW, top + qh);
      qg.stop(0, NAVY_900).stop(1, TEAL_800);
      doc.roundedRect(M, top, CW, qh, 11).fill(qg);
      doc
        .font(POPPINS.semibold)
        .fontSize(7.5)
        .fillColor(TEAL_300)
        .text("OUR GUARANTEE", M + 28, top + 20, { width: CW - 56, characterSpacing: 1.3 });
      doc
        .font(POPPINS.bold)
        .fontSize(15)
        .fillColor(WHITE)
        .text(guarantee, M + 28, top + 36, { width: CW - 56, lineGap: 3 });
      doc.y = top + qh + 22;
    }

    if (journey.length > 0) {
      eyebrow("How a client journey runs");
      doc.font(POPPINS.semibold).fontSize(10);
      const CHIP_H = 26;
      const ROW_GAP = 10;
      let x = M;
      let top = doc.y + 2;
      journey.forEach((stage, i) => {
        const w = doc.widthOfString(stage) + 28;
        // Wrapping used to reset x without moving down a row, so a long
        // journey drew its later chips on top of its earlier ones.
        if (x > M && x + w > M + CW) {
          x = M;
          top += CHIP_H + ROW_GAP;
        }
        doc.roundedRect(x, top, w, CHIP_H, 13).lineWidth(0.8).fillAndStroke(WHITE, RULE);
        doc.font(POPPINS.semibold).fontSize(10).fillColor(NAVY_900).text(stage, x, top + 8, { width: w, align: "center" });
        x += w;

        if (i < journey.length - 1) {
          // Drawn, not typed: this Poppins has no U+2192, so a literal "→"
          // rendered as a tofu box between every pair of chips.
          const ax = x + 6;
          const ay = top + CHIP_H / 2;
          doc.save().lineWidth(1.1).strokeColor(FAINT).lineCap("round").lineJoin("round");
          doc.moveTo(ax, ay).lineTo(ax + 11, ay).stroke();
          doc.moveTo(ax + 7, ay - 3.5).lineTo(ax + 11, ay).lineTo(ax + 7, ay + 3.5).stroke();
          doc.restore();
          x += 24;
        }
      });
      doc.y = top + CHIP_H + 18;
    }
  }

  // ============================ METRICS ===========================
  const metrics = l("metrics_list");
  if (metrics.length > 0) {
    section("white");
    eyebrow("What leadership watches every week");
    doc.font(POPPINS.semibold).fontSize(11);
    let x = M;
    let top = doc.y + 2;
    metrics.forEach((m) => {
      const w = doc.widthOfString(m) + 30;
      if (x + w > M + CW) {
        x = M;
        top += 38;
      }
      doc.roundedRect(x, top, w, 28, 14).lineWidth(0.8).fillAndStroke(TEAL_100, TEAL_200);
      doc.font(POPPINS.semibold).fontSize(11).fillColor(TEAL_800).text(m, x, top + 8, { width: w, align: "center" });
      x += w + 10;
    });
    doc.y = top + 28 + 22;
  }

  // ====================== WHAT STANDS IN THE WAY ==================
  const obstacles = l("obstacles_list");
  const barrier = t("barrier_text");
  if (obstacles.length > 0 || barrier) {
    section("deep");
    eyebrow("Said plainly");
    heading("What stands between here and there.");

    if (obstacles.length > 0) {
      eyebrow("Obstacles");
      obstacles.forEach((o) => {
        ensure(34);
        const y = doc.y;
        doc.circle(M + 3, y + 7, 2.5).fill(WARNING);
        doc.font(POPPINS.regular).fontSize(11).fillColor("#e6edf7").text(o, M + 16, y, { width: CW - 16, lineGap: 2.5 });
        doc.moveDown(0.4);
        doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.6).strokeColor("#2b3d5c").stroke();
        doc.moveDown(0.5);
      });
      doc.moveDown(0.6);
    }

    if (barrier) {
      ensure(80);
      const top = doc.y;
      doc.font(POPPINS.semibold).fontSize(7.5).fillColor(TEAL_300).text("THE ONE BARRIER TO DOUBLING", M + 18, top, {
        width: CW - 18,
        characterSpacing: 1.3,
      });
      doc.moveDown(0.35);
      doc.font(POPPINS.medium).fontSize(13).fillColor(WHITE).text(barrier, M + 18, doc.y, { width: CW * 0.74, lineGap: 3 });
      doc
        .moveTo(M, top - 2)
        .lineTo(M, doc.y + 2)
        .lineWidth(2.5)
        .strokeColor(WARNING)
        .stroke();
      doc.moveDown(0.8);
    }
  }

  // =========================== SIGN-OFF ===========================
  if (signName) {
    section("white");
    doc.y = H / 2 - 60;
    eyebrow("Signed off by leadership");
    doc.font(POPPINS.regular).fontSize(26).fillColor(NAVY_900).text(signName, M, doc.y, { width: CW * 0.7 });
    doc.moveDown(0.3);
    doc
      .moveTo(M, doc.y)
      .lineTo(M + 260, doc.y)
      .lineWidth(1)
      .strokeColor(RULE)
      .stroke();
    doc.moveDown(0.6);
    doc
      .font(POPPINS.regular)
      .fontSize(10)
      .fillColor(MUTED)
      .text([signTitle, signDate && `signed ${signDate}`].filter(Boolean).join("  ·  "), M, doc.y, { width: CW });
  }

  // ---- Footer on every page except the cover ----
  const range = doc.bufferedPageRange();
  for (let i = range.start + 1; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const y = H - M + 14;
    doc
      .font(POPPINS.regular)
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(`${name}  ·  Vision Board`, M, y, { width: CW / 2, lineBreak: false });
    doc.text(`${i - range.start + 1} / ${range.count}`, M + CW / 2, y, {
      width: CW / 2,
      align: "right",
      lineBreak: false,
    });
  }
}
