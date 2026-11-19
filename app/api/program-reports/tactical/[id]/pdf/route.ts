import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { registerPoppins } from "@/lib/pdf/poppins";
import { renderTacticalReport } from "@/lib/pdf/tactical-report-doc";
import type { DeliverableSnapshot } from "@/lib/programs/deliverables";
import { previousMonth, shortMonth } from "@/lib/programs/programs";
import { TACTICAL_COLUMNS, figures, type TacticalRow } from "@/lib/programs/tactical";
import { monthLabel } from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/program-reports/tactical/[id]/pdf — one month's TacticalLeads
 * report as a PDF (client-confirmed 2026-11-16).
 *
 * The session client under RLS decides who gets it: CRO Admin and CRO
 * Advisor read every report; anyone else reads only published reports of an
 * account they can see (tactical_reports_select). A report they can't read
 * is simply not found.
 *
 * A draft has no saved MQC count or Next Deliverables list yet, so both are
 * read live for the CRO team's download; a published report always carries
 * its own.
 *
 * Poppins and the logo are read from disk, so this route is listed under
 * `outputFileTracingIncludes` in next.config.ts.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase.from("tactical_reports").select(TACTICAL_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "No such report." }, { status: 404 });
  const row = data as unknown as TacticalRow;

  const prevKey = previousMonth(row.month);
  const [{ data: account }, { data: prevData }, live, liveList] = await Promise.all([
    supabase.from("accounts").select("name").eq("id", row.account_id).maybeSingle(),
    supabase
      .from("tactical_reports")
      .select(TACTICAL_COLUMNS)
      .eq("account_id", row.account_id)
      .eq("month", prevKey)
      .not("published_at", "is", null)
      .maybeSingle(),
    row.gm_numbers ? Promise.resolve({ data: null }) : supabase.rpc("tactical_numbers", { p_account_id: row.account_id, p_month: row.month }),
    row.published_at ? Promise.resolve({ data: null }) : supabase.rpc("tactical_deliverables", { p_account_id: row.account_id, p_month: row.month }),
  ]);
  const deliverables = ((row.published_at ? row.deliverables : liveList.data) ?? []) as DeliverableSnapshot[];
  if (!row.gm_numbers && live.data) row.gm_numbers = live.data as TacticalRow["gm_numbers"];
  const prev = prevData ? (prevData as unknown as TacticalRow) : null;
  const clientName = account?.name ?? "TacticalLeads client";

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderTacticalReport(doc, {
    clientName,
    monthLabel: monthLabel(row.month),
    prevLabel: prev ? shortMonth(prevKey) : null,
    cur: figures(row),
    prev: prev ? figures(prev) : null,
    deliverables,
  });

  doc.end();
  const buffer = await done;
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tacticalleads-${slug}-${row.month.slice(0, 7)}.pdf"`,
    },
  });
}
