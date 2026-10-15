import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getTargets } from "@/lib/advocate-dash/queries";
import { ADVOCATE_DASH_SLUG, targetSummary } from "@/lib/advocate-dash/targets";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import { getMissionData, getStepDetail, getTasksForStep } from "@/lib/growth-mission/queries";
import { registerPoppins } from "@/lib/pdf/poppins";
import { renderStatusReport } from "@/lib/pdf/status-report-doc";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/growth-mission/[slug]/export — the discipline Status Report as a
 * PDF (client-confirmed, 2026-09-25).
 *
 * Anyone who can view the discipline can export it, so the ordinary session
 * client under RLS is enough — no service role. The reads go through the
 * same getStepDetail/getTasksForStep the page uses, so the PDF can never
 * show something the reader is not allowed to see on screen.
 *
 * Poppins is the brand font for every GrowthMission PDF and its TTFs are read
 * from disk, so this route stays listed under `outputFileTracingIncludes`
 * in next.config.ts. The layout lives in lib/pdf/status-report-doc.ts.
 *
 * Client-confirmed (2026-10-14, "PDF Exports Refresh"): the masthead says
 * "Mission Card N of 17" (2026-10-15: "Discipline" is internal wording; users
 * see Mission Card), and AdvocateDash counts drop-bys the way its card
 * on screen does, read through the same getTargets/targetSummary.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user || !user.account_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shape = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  if (!shape) {
    return NextResponse.json({ error: "No such discipline." }, { status: 404 });
  }

  const quarter = currentQuarter();
  const supabase = await createClient();
  const [step, mission, tasks, { data: account }, targets] = await Promise.all([
    getStepDetail(user.account_id, slug),
    getMissionData(user.account_id, quarter),
    getTasksForStep(user.account_id, slug),
    supabase.from("accounts").select("name").eq("id", user.account_id).maybeSingle(),
    slug === ADVOCATE_DASH_SLUG ? getTargets(user.account_id) : Promise.resolve(null),
  ]);

  if (!step) {
    return NextResponse.json({ error: "No such discipline." }, { status: 404 });
  }

  const stepHours = mission.stepHours[step.slug];

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderStatusReport(doc, {
    accountName: account?.name ?? "GrowthMission Account",
    stepTitle: step.title,
    phaseTitle: `Mission Card ${shape.number} of ${PLAYBOOK_STEPS.length}`,
    quarterLabel: `${quarter.label} · ${quarter.range}`,
    summary: step.statusReportSummary,
    stats: step.statusReportStats,
    tasks,
    hours: {
      required: stepHours?.required ?? 0,
      committed: stepHours?.committed ?? 0,
      completed: stepHours?.completed ?? 0,
    },
    dropbys: targets ? targetSummary(targets) : undefined,
  });

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growthmission-${slug}-status-report.pdf"`,
    },
  });
}
