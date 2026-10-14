import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter, parseQuarterKey } from "@/lib/growth-mission/hours";
import { getReportsData } from "@/lib/reports/data";

/**
 * Backend Schema §10 — GET /api/reports/export?section=…&q=2026-Q3.
 * Session (any role that can view Reports). Streaming an XLSX file is a
 * multi-step operation (ExcelJS), so it is a server route (§11); the
 * on-screen numbers are still direct reads.
 *
 * Client-confirmed (2026-10-14, "Reports Redesign"): exports follow the
 * quarter chosen on the page, and read through the page's own
 * getReportsData(), so a spreadsheet can never disagree with the screen it
 * was exported from. That also scopes every query to the account, which
 * the old route did not. "mission" (quarter history) is new.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const section = request.nextUrl.searchParams.get("section");
  const quarter = parseQuarterKey(request.nextUrl.searchParams.get("q")) ?? currentQuarter();
  const data = await getReportsData(user.account_id, quarter);
  const q = data.selected;
  const workbook = new ExcelJS.Workbook();

  if (section === "leads") {
    const sheet = workbook.addWorksheet(`Leads ${q.label}`);
    sheet.columns = [
      { header: "Week Of", key: "week", width: 16 },
      { header: "Leads Added", key: "count", width: 14 },
    ];
    q.leadsWeekly.forEach((count, i) => {
      if (i < q.weeksElapsed) sheet.addRow({ week: q.weekStarts[i], count });
    });
  } else if (section === "pipeline") {
    const sheet = workbook.addWorksheet("Pipeline");
    sheet.columns = [
      { header: "Stage", key: "stage", width: 32 },
      { header: "Group", key: "group", width: 12 },
      { header: "Count", key: "count", width: 10 },
    ];
    for (const s of data.stages) {
      sheet.addRow({ stage: s.name, group: s.stage_group[0].toUpperCase() + s.stage_group.slice(1), count: s.count });
    }
  } else if (section === "campaigns") {
    const sheet = workbook.addWorksheet(`Campaigns ${q.label}`);
    sheet.columns = [
      { header: "Campaign", key: "name", width: 32 },
      { header: "Sent", key: "sent", width: 10 },
      { header: "Open Rate", key: "openRate", width: 12 },
      { header: "Click Rate", key: "clickRate", width: 12 },
      { header: "Bounced", key: "bounced", width: 10 },
      { header: "Unsubscribed", key: "unsub", width: 14 },
    ];
    const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);
    for (const c of q.campaigns) {
      sheet.addRow({
        name: c.name,
        sent: c.sent,
        openRate: pct(c.openRate),
        clickRate: pct(c.clickRate),
        bounced: c.bounced,
        unsub: c.unsubscribed,
      });
    }
  } else if (section === "revenue") {
    const sheet = workbook.addWorksheet(`Revenue ${q.label}`);
    sheet.columns = [
      { header: "Month", key: "month", width: 14 },
      { header: "Revenue", key: "revenue", width: 14 },
    ];
    q.revenueMonthly.forEach((revenue, i) => sheet.addRow({ month: q.monthLabels[i], revenue }));
    sheet.addRow({ month: "Total", revenue: q.revenueMonthly.reduce((s, v) => s + v, 0) });
  } else if (section === "mission") {
    const sheet = workbook.addWorksheet("Quarter history");
    sheet.columns = [
      { header: "Quarter", key: "quarter", width: 12 },
      { header: "Status", key: "status", width: 10 },
      { header: "Hours Required", key: "hr", width: 16 },
      { header: "Hours Available", key: "ha", width: 16 },
      { header: "Hours Completed", key: "hc", width: 16 },
      { header: "Credits Required", key: "cr", width: 16 },
      { header: "Credits Used", key: "cu", width: 14 },
      { header: "Credits Left", key: "cl", width: 14 },
      { header: "Orders Completed", key: "oc", width: 17 },
      { header: "Carried Forward", key: "ocf", width: 16 },
    ];
    for (const m of data.history) {
      sheet.addRow({
        quarter: m.label,
        status: m.isCurrent ? "So far" : "Locked",
        hr: m.hoursRequired,
        ha: m.hoursAvailable,
        hc: m.hoursCompleted,
        cr: m.creditsRequired,
        cu: m.creditsUsed,
        cl: m.creditsLeft ?? "—",
        oc: m.ordersCompleted,
        ocf: m.ordersCarried ?? "—",
      });
    }
  } else {
    return NextResponse.json({ error: "Unknown report section." }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = section === "pipeline" || section === "mission" ? "" : `-${q.key}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="growthmission-${section}${suffix}-report.xlsx"`,
    },
  });
}
