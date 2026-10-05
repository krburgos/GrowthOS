import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getTarget, getVisitPhotos, getVisitReport } from "@/lib/advocate-dash/queries";
import { registerPoppins } from "@/lib/pdf/poppins";
import { renderVisitReport } from "@/lib/pdf/visit-report-doc";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/advocate-dash/[targetId]/report — one VictoryVisit After-Action
 * Report as a PDF (client-confirmed, 2026-10-05).
 *
 * Anyone who can see the target can export its report, so the ordinary
 * session client under RLS is enough — no service role. Every read goes
 * through the same queries the page uses, so the PDF can never show
 * something the reader is not allowed to see on screen; a target belonging
 * to another tenant simply comes back empty and this answers 404.
 *
 * Poppins is the brand font for every GrowthOS PDF and its TTFs are read
 * from disk, so this route must stay listed under
 * `outputFileTracingIncludes` in next.config.ts or Vercel will not bundle
 * them. The layout lives in lib/pdf/visit-report-doc.ts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  const { targetId } = await params;

  const user = await getCurrentUser();
  if (!user || !user.account_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const [target, report, photos, { data: account }] = await Promise.all([
    getTarget(user.account_id, targetId),
    getVisitReport(user.account_id, targetId),
    getVisitPhotos(user.account_id, targetId),
    supabase.from("accounts").select("name").eq("id", user.account_id).maybeSingle(),
  ]);

  if (!target) {
    return NextResponse.json({ error: "No such target." }, { status: 404 });
  }
  if (!report) {
    return NextResponse.json({ error: "No report has been filed for this target." }, { status: 404 });
  }

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderVisitReport(doc, {
    accountName: account?.name ?? "GrowthOS Account",
    targetName: target.target_name,
    companyName: target.company_name,
    address: target.address,
    advocateName: target.advocate?.name ?? null,
    completedOn: target.completed_on,
    submittedAt: report.submitted_at,
    answers: report.answers,
    photoCaptions: photos.map((p) => p.caption ?? "Photo"),
  });

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="victory-visit-${slug(target.target_name)}.pdf"`,
    },
  });
}

/** A filename-safe version of the target's name. */
function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "report"
  );
}
