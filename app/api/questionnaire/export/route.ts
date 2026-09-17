import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { QUESTIONNAIRE_SECTIONS, countAnswered, TOTAL_QUESTION_COUNT, type QuestionType } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";

function formatAnswer(raw: string | number | null | undefined, type: QuestionType): string {
  if (raw === null || raw === undefined || raw === "") return "Not answered";
  if (type === "yesno") return raw === "yes" ? "Yes" : "No";
  if (type === "scale") return `${raw} / 4`;
  return String(raw);
}

/**
 * Backend Schema §10 — GET /api/questionnaire/export. Session (any role
 * with RLS read access to growth_questionnaire_responses — the regular
 * server client is enough here, no secret/service role involved, same
 * hybrid-access reasoning as /api/reports/export). Renders the fixed
 * question list (lib/questionnaire/questions.ts) against the account's
 * saved answers with pdfkit, streamed back as a single buffered PDF.
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

  const answers = (response.answers ?? {}) as Record<string, string | number | null>;

  const doc = new PDFDocument({ size: "LETTER", margins: { top: 56, bottom: 56, left: 56, right: 56 } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#022a66").text("GrowthOS Solution Questionnaire");
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(12).fillColor("#576177").text(account?.name ?? "GrowthOS Account");
  doc.font("Helvetica").fontSize(9.5).fillColor("#9aa4b8").text(`${countAnswered(answers)} of ${TOTAL_QUESTION_COUNT} questions answered`);
  doc.moveDown(1.1);

  for (const section of QUESTIONNAIRE_SECTIONS) {
    if (doc.y > 680) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#022a66").text(section.name);
    doc.moveDown(0.35);

    for (const q of section.questions) {
      if (doc.y > 700) doc.addPage();
      doc.font("Helvetica").fontSize(10.5).fillColor("#262e40").text(q.label);
      const answerText = formatAnswer(answers[q.key], q.type);
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(answerText === "Not answered" ? "#9aa4b8" : "#028eab")
        .text(answerText);
      doc.moveDown(0.55);
    }
    doc.moveDown(0.5);
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growth-solution-questionnaire.pdf"`,
    },
  });
}
