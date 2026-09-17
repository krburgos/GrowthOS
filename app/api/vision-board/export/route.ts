import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { POPPINS, registerPoppins } from "@/lib/pdf/poppins";
import { createClient } from "@/lib/supabase/server";
import { VISION_BOARD_SECTIONS } from "@/lib/vision-board/sections";

type Answers = Record<string, string | string[] | null>;

const NAVY = "#022a66";
const TEAL = "#028eab";
const INK = "#262e40";
const MUTED = "#576177";
const FAINT = "#9aa4b8";
const RULE = "#e2e6ed";

const MARGIN = 54;
const NOT_ANSWERED = "Not answered";

function text(answers: Answers, key: string): string | null {
  const v = answers[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function list(answers: Answers, key: string): string[] {
  const v = answers[key];
  return Array.isArray(v) ? v.filter((item) => item.trim()) : [];
}

function yesNo(v: unknown) {
  return v === "yes" ? "Yes" : v === "no" ? "No" : NOT_ANSWERED;
}

/**
 * Backend Schema §10 — GET /api/vision-board/export (client-confirmed
 * 2026-09-17). Anyone who can view the Vision Board can export it, so the
 * regular session client under vision_board_responses RLS is enough — no
 * service role. Same pdfkit approach and Poppins brand font as /api/questionnaire/export, laid
 * out to match the on-screen strategy document: every section in wizard
 * order, financial goals as figure boxes, page numbers in the footer.
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

  const [{ data: response }, { data: account }, { data: questionnaire }] = await Promise.all([
    supabase.from("vision_board_responses").select("answers").eq("account_id", accountId).maybeSingle(),
    supabase.from("accounts").select("name").eq("id", accountId).maybeSingle(),
    supabase.from("growth_questionnaire_responses").select("answers").eq("account_id", accountId).maybeSingle(),
  ]);

  if (!response) {
    return NextResponse.json({ error: "No Vision Board found for this account." }, { status: 404 });
  }

  const answers = (response.answers ?? {}) as Answers;
  const qAnswers = (questionnaire?.answers ?? {}) as Record<string, unknown>;
  const accountName = account?.name ?? "GrowthOS Account";

  const doc = new PDFDocument({ size: "LETTER", margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const contentWidth = doc.page.width - MARGIN * 2;
  const bottomLimit = () => doc.page.height - MARGIN - 18;
  const ensure = (space: number) => {
    if (doc.y + space > bottomLimit()) doc.addPage();
  };

  const label = (value: string) => {
    ensure(40);
    doc.moveDown(0.35);
    doc.font(POPPINS.semibold).fontSize(7.5).fillColor(FAINT).text(value.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.4 });
    doc.moveDown(0.15);
  };

  const body = (value: string | null) => {
    ensure(24);
    doc
      .font(POPPINS.regular)
      .fontSize(10)
      .fillColor(value ? INK : FAINT)
      .text(value ?? NOT_ANSWERED, MARGIN, doc.y, { width: contentWidth, lineGap: 2 });
  };

  const numbered = (items: string[]) => {
    if (items.length === 0) return body(null);
    items.forEach((item, i) => {
      ensure(24);
      doc.font(POPPINS.semibold).fontSize(10).fillColor(TEAL).text(`${i + 1}.`, MARGIN, doc.y, { continued: true, width: contentWidth });
      doc.font(POPPINS.regular).fillColor(INK).text(`  ${item}`, { width: contentWidth, lineGap: 2 });
      doc.moveDown(0.2);
    });
  };

  const figures = (items: { label: string; value: string | null }[]) => {
    const gap = 6;
    const boxWidth = (contentWidth - gap * (items.length - 1)) / items.length;
    doc.font(POPPINS.semibold).fontSize(10);
    const valueHeight = Math.max(...items.map((f) => doc.heightOfString(f.value ?? NOT_ANSWERED, { width: boxWidth - 12 })));
    const boxHeight = 22 + valueHeight;
    ensure(boxHeight + 8);
    const top = doc.y + 4;
    items.forEach((f, i) => {
      const x = MARGIN + i * (boxWidth + gap);
      doc.roundedRect(x, top, boxWidth, boxHeight, 3).lineWidth(0.75).strokeColor(RULE).stroke();
      doc.font(POPPINS.semibold).fontSize(7).fillColor(FAINT).text(f.label.toUpperCase(), x + 6, top + 6, { width: boxWidth - 12, lineBreak: false, ellipsis: true });
      doc
        .font(POPPINS.semibold)
        .fontSize(10)
        .fillColor(f.value ? NAVY : FAINT)
        .text(f.value ?? NOT_ANSWERED, x + 6, top + 16, { width: boxWidth - 12 });
    });
    doc.x = MARGIN;
    doc.y = top + boxHeight + 10;
  };

  // ---- Header ----
  const signName = text(answers, "signoff_name");
  const signTitle = text(answers, "signoff_title");
  const signDate = text(answers, "signoff_date");
  const signedLine = signName
    ? `Signed off by ${signName}${signTitle ? `, ${signTitle}` : ""}${signDate ? ` · ${signDate}` : ""}`
    : "Not signed off yet";

  doc.font(POPPINS.semibold).fontSize(8.5).fillColor(TEAL).text("GROWTHOS", MARGIN, MARGIN, { width: contentWidth, align: "right", characterSpacing: 0.6 });
  doc.font(POPPINS.bold).fontSize(20).fillColor(NAVY).text("GrowthOS Vision Board", MARGIN, MARGIN);
  doc.font(POPPINS.regular).fontSize(10.5).fillColor(MUTED).text(`${accountName}  ·  ${signedLine}`);
  doc.moveDown(0.5);
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + contentWidth, doc.y).lineWidth(1.5).strokeColor(NAVY).stroke();
  doc.moveDown(0.6);

  // ---- Sections ----
  VISION_BOARD_SECTIONS.forEach((section, index) => {
    ensure(60);
    doc.moveDown(0.6);
    const heading = section.key === "signoff" ? section.name : `${index + 1}. ${section.name}`;
    doc.font(POPPINS.semibold).fontSize(13).fillColor(NAVY).text(heading, MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(0.15);

    switch (section.key) {
      case "values":
        body(list(answers, "values_list").join("  ·  ") || null);
        break;
      case "focus":
        label("Purpose");
        body(text(answers, "focus_purpose"));
        label("Niche");
        body(text(answers, "focus_niche"));
        break;
      case "target10":
        body(text(answers, "target10_text"));
        break;
      case "marketing": {
        label("Ideal Customer Profile (from the GrowthOS Solution Questionnaire)");
        const target = typeof qAnswers.overview_target_market === "string" && qAnswers.overview_target_market.trim()
          ? qAnswers.overview_target_market.trim()
          : NOT_ANSWERED;
        body(`Target market: ${target}  ·  Specific verticals: ${yesNo(qAnswers.overview_verticals)}  ·  High-value client defined: ${yesNo(qAnswers.overview_hvc_defined)}`);
        label("Three Uniques");
        numbered(["unique_1", "unique_2", "unique_3"].map((k) => text(answers, k)).filter((v): v is string => !!v));
        label("Proven Process");
        body(list(answers, "process_stages").join("  ›  ") || null);
        label("Guarantee");
        body(text(answers, "guarantee_text"));
        break;
      }
      case "picture3":
        figures([
          { label: "Annual revenue", value: text(answers, "picture3_revenue") },
          { label: "Gross profit", value: text(answers, "picture3_gross_profit") },
          { label: "Net profit", value: text(answers, "picture3_net_profit") },
          { label: "MRR", value: text(answers, "picture3_mrr") },
        ]);
        for (const [l, k] of [
          ["Team", "picture3_team"],
          ["Clients", "picture3_clients"],
          ["Market position", "picture3_market_position"],
          ["Operations", "picture3_operations"],
        ]) {
          label(l);
          body(text(answers, k));
        }
        break;
      case "plan1":
        figures([
          { label: "Revenue goal", value: text(answers, "plan1_revenue_goal") },
          { label: "Gross profit goal", value: text(answers, "plan1_gross_profit_goal") },
          { label: "Net profit goal", value: text(answers, "plan1_net_profit_goal") },
          { label: "MRR goal", value: text(answers, "plan1_mrr_goal") },
          { label: "New clients", value: text(answers, "plan1_new_client_goal") },
        ]);
        label("Top annual priorities");
        numbered(list(answers, "plan1_priorities"));
        break;
      case "obstacles":
        numbered(list(answers, "obstacles_list"));
        break;
      case "metrics":
        body(list(answers, "metrics_list").join("  ·  ") || null);
        break;
      case "barrier":
        label("The biggest barrier to doubling revenue in 36 months");
        body(text(answers, "barrier_text"));
        break;
      case "signoff":
        body(signName ? `${signName}${signTitle ? `, ${signTitle}` : ""}` : null);
        if (signDate) body(`Signed ${signDate}`);
        break;
    }
  });

  // ---- Footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGIN + 14;
    doc.page.margins.bottom = 0;
    doc.moveTo(MARGIN, y - 6).lineTo(MARGIN + contentWidth, y - 6).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
    doc.text(`GrowthOS Vision Board  ·  ${accountName}`, MARGIN, y, { width: contentWidth / 2, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN + contentWidth / 2, y, {
      width: contentWidth / 2,
      align: "right",
      lineBreak: false,
    });
  }

  doc.end();
  const buffer = await done;
  const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growthos-vision-board-${slug}.pdf"`,
    },
  });
}
