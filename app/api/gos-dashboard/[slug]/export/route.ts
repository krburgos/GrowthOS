import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter } from "@/lib/gos-dashboard/hours";
import { PLAYBOOK_PHASES, PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";
import { getStepDetail, getStepHours, getTasksForStep } from "@/lib/gos-dashboard/queries";
import { registerPoppins } from "@/lib/pdf/poppins";
import { renderStatusReport } from "@/lib/pdf/status-report-doc";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gos-dashboard/[slug]/export — the workstream Status Report as a
 * PDF (client-confirmed, 2026-09-25).
 *
 * Anyone who can view the workstream can export it, so the ordinary session
 * client under RLS is enough — no service role. The reads go through the
 * same getStepDetail/getTasksForStep the page uses, so the PDF can never
 * show something the reader is not allowed to see on screen.
 *
 * Poppins is the brand font for every GrowthOS PDF and its TTFs are read
 * from disk, so this route stays listed under `outputFileTracingIncludes`
 * in next.config.ts. The layout lives in lib/pdf/status-report-doc.ts.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user || !user.account_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shape = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  if (!shape) {
    return NextResponse.json({ error: "No such workstream." }, { status: 404 });
  }

  const quarter = currentQuarter();
  const supabase = await createClient();
  const [step, hours, tasks, { data: account }] = await Promise.all([
    getStepDetail(user.account_id, slug),
    getStepHours(user.account_id, quarter.start),
    getTasksForStep(user.account_id, slug),
    supabase.from("accounts").select("name").eq("id", user.account_id).maybeSingle(),
  ]);

  if (!step) {
    return NextResponse.json({ error: "No such workstream." }, { status: 404 });
  }

  const stepHours = hours[step.slug];
  const phase = PLAYBOOK_PHASES.find((p) => p.phase === shape.phase);

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderStatusReport(doc, {
    accountName: account?.name ?? "GrowthOS Account",
    stepTitle: step.title,
    phaseTitle: phase?.name ?? "GrowthOS Playbook",
    quarterLabel: `${quarter.label} · ${quarter.range}`,
    summary: step.statusReportSummary,
    stats: step.statusReportStats,
    tasks,
    hours: {
      needed: stepHours?.needed ?? 0,
      committed: stepHours?.committed ?? 0,
      achieved: stepHours?.achieved ?? 0,
    },
  });

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growthos-${slug}-status-report.pdf"`,
    },
  });
}
