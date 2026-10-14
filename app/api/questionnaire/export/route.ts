import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { QUESTIONNAIRE_PDF_MARGIN as M, renderQuestionnaire, type AnswerValue } from "@/lib/pdf/questionnaire-doc";
import { registerPoppins } from "@/lib/pdf/poppins";
import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — GET /api/questionnaire/export. Session (any role with
 * RLS read access to growth_questionnaire_responses — the regular server
 * client is enough, no service role involved). The layout is drawn by
 * renderQuestionnaire (lib/pdf/questionnaire-doc.ts).
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
  const accountName = account?.name ?? "GrowthMission Account";
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 0, bottom: 0, left: M, right: M }, bufferPages: true });
  registerPoppins(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderQuestionnaire(doc, accountName, answers);

  doc.end();
  const buffer = await done;
  const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growthmission-solution-questionnaire-${slug}.pdf"`,
    },
  });
}
