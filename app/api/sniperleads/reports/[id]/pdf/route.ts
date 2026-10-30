import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { registerPoppins } from "@/lib/pdf/poppins";
import { renderSniperLeadsReport } from "@/lib/pdf/sniperleads-report-doc";
import {
  defaultClosing,
  defaultIntro,
  firstName,
  monthLabel,
  monthNumber,
  type GmNumbers,
  type ReportRow,
} from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/sniperleads/reports/[id]/pdf — one client's SniperLeads monthly
 * report as a PDF (client-confirmed, 2026-10-30). CRO Admin and CRO Advisor.
 *
 * The session client under RLS is enough: sniperleads_reports is readable
 * only by those two roles, so a report anyone else asks for is simply not
 * found. The editor saves (and marks exported) before it opens this, so the
 * row always holds what the preview showed.
 *
 * Poppins and the logo are read from disk, so this route is listed under
 * `outputFileTracingIncludes` in next.config.ts.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !["cro_admin", "cro_advisor"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("sniperleads_reports")
    .select(
      "id, account_id, month, emails_sent, real_replies, auto_replies, calls, ad_audience, linkedin_started, linkedin_invites, linkedin_messages, website_started, website_visits, intro, closing, signer_id, gm_numbers, exported_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ error: "No such report." }, { status: 404 });
  }
  const row = report as ReportRow;

  const [{ data: account }, { data: setting }, { data: owner }, { data: signer }, live] = await Promise.all([
    supabase.from("accounts").select("name").eq("id", row.account_id).maybeSingle(),
    supabase.from("sniperleads_clients").select("start_month").eq("account_id", row.account_id).maybeSingle(),
    supabase
      .from("users")
      .select("full_name")
      .eq("account_id", row.account_id)
      .eq("role", "msp_owner")
      .is("archived_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    row.signer_id ? supabase.from("users").select("full_name").eq("id", row.signer_id).maybeSingle() : Promise.resolve({ data: null }),
    row.gm_numbers ? Promise.resolve({ data: null }) : supabase.rpc("sniperleads_numbers", { p_account_id: row.account_id }),
  ]);

  const gm: GmNumbers = {
    pool: 0,
    flagged: 0,
    opportunities: 0,
    meetings: 0,
    proposals: 0,
    won: 0,
    ...((row.gm_numbers ?? live.data ?? {}) as Partial<GmNumbers>),
  };
  const clientName = account?.name ?? "SniperLeads client";

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderSniperLeadsReport(doc, {
    clientName,
    greetingName: firstName(owner?.full_name),
    monthLabel: monthLabel(row.month),
    monthNumber: monthNumber(setting?.start_month ?? row.month, row.month),
    gm,
    outreach: row,
    intro: row.intro?.trim() || defaultIntro(gm, row.month),
    closing: row.closing?.trim() || defaultClosing(),
    signerName: signer?.full_name ?? "",
  });

  doc.end();
  const buffer = await done;
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sniperleads-${slug}-${row.month.slice(0, 7)}.pdf"`,
    },
  });
}
