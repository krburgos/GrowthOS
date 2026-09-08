import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS_BACK = 8;
const MONTHS_BACK = 3;

/**
 * Backend Schema §10 — GET /api/reports/export. Session (any role that
 * can view Reports — App Flow §2.4 gives every MSP role at least View).
 * The one server route this screen needs: streaming an XLSX file is a
 * multi-step operation (ExcelJS), not something to build client-side
 * (§11) — the on-screen numbers themselves are still a direct browser→
 * Supabase read (app/(app)/(msp-shell)/reports/page.tsx). Re-derives
 * the same aggregates that page computes rather than sharing state,
 * since this is a separate request.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const section = request.nextUrl.searchParams.get("section");
  const workbook = new ExcelJS.Workbook();

  if (section === "leads") {
    const now = Date.now();
    const weeksStart = new Date(now - WEEKS_BACK * WEEK_MS).toISOString();
    const { data: contacts } = await supabase
      .from("contacts")
      .select("created_at")
      .is("archived_at", null)
      .gte("created_at", weeksStart);

    const sheet = workbook.addWorksheet("Leads");
    sheet.columns = [
      { header: "Week Of", key: "week", width: 16 },
      { header: "Leads Added", key: "count", width: 14 },
    ];
    for (let i = 0; i < WEEKS_BACK; i++) {
      const bucketStart = now - (WEEKS_BACK - i) * WEEK_MS;
      const bucketEnd = bucketStart + WEEK_MS;
      const count = (contacts ?? []).filter((c) => {
        const t = new Date(c.created_at).getTime();
        return t >= bucketStart && t < bucketEnd;
      }).length;
      sheet.addRow({ week: new Date(bucketStart).toLocaleDateString(), count });
    }
  } else if (section === "pipeline") {
    const [{ data: stages }, { data: opportunities }] = await Promise.all([
      supabase.from("opportunity_stages").select("id, name, stage_group").is("archived_at", null).order("sort_order"),
      supabase.from("opportunities").select("id, stage_id"),
    ]);
    const countByStage = new Map<string, number>();
    for (const o of opportunities ?? []) {
      countByStage.set(o.stage_id, (countByStage.get(o.stage_id) ?? 0) + 1);
    }

    const sheet = workbook.addWorksheet("Pipeline");
    sheet.columns = [
      { header: "Stage", key: "stage", width: 32 },
      { header: "Group", key: "group", width: 12 },
      { header: "Count", key: "count", width: 10 },
    ];
    for (const s of stages ?? []) {
      sheet.addRow({ stage: s.name, group: (s.stage_group as StageGroup)[0].toUpperCase() + s.stage_group.slice(1), count: countByStage.get(s.id) ?? 0 });
    }
  } else if (section === "campaigns") {
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "sent")
      .is("archived_at", null)
      .order("sent_at", { ascending: false });

    const campaignIds = (campaigns ?? []).map((c) => c.id);
    const { data: recipients } =
      campaignIds.length > 0
        ? await supabase.from("campaign_recipients").select("campaign_id, status, open_count, click_count").in("campaign_id", campaignIds)
        : { data: [] as { campaign_id: string; status: string; open_count: number; click_count: number }[] };

    const statsByCampaign = new Map<string, { total: number; sent: number; opened: number; clicked: number; bounced: number; unsub: number }>();
    for (const r of recipients ?? []) {
      const s = statsByCampaign.get(r.campaign_id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
      s.total += 1;
      if (r.status === "sent") s.sent += 1;
      if (r.status === "bounced") s.bounced += 1;
      if (r.status === "unsubscribed") s.unsub += 1;
      if ((r.open_count ?? 0) > 0) s.opened += 1;
      if ((r.click_count ?? 0) > 0) s.clicked += 1;
      statsByCampaign.set(r.campaign_id, s);
    }

    const sheet = workbook.addWorksheet("Campaigns");
    sheet.columns = [
      { header: "Campaign", key: "name", width: 32 },
      { header: "Sent", key: "sent", width: 10 },
      { header: "Open Rate", key: "openRate", width: 12 },
      { header: "Click Rate", key: "clickRate", width: 12 },
      { header: "Bounced", key: "bounced", width: 10 },
      { header: "Unsubscribed", key: "unsub", width: 14 },
    ];
    for (const c of campaigns ?? []) {
      const s = statsByCampaign.get(c.id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
      sheet.addRow({
        name: c.name,
        sent: s.total,
        openRate: s.sent > 0 ? `${((s.opened / s.sent) * 100).toFixed(1)}%` : "—",
        clickRate: s.sent > 0 ? `${((s.clicked / s.sent) * 100).toFixed(1)}%` : "—",
        bounced: s.bounced,
        unsub: s.unsub,
      });
    }
  } else if (section === "revenue") {
    const { data: won } = await supabase
      .from("opportunities")
      .select("id, name, value, closed_at, opportunity_stages!inner(stage_group)")
      .eq("opportunity_stages.stage_group", "won")
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false });

    const monthBuckets = Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (MONTHS_BACK - 1 - i));
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
    });

    const sheet = workbook.addWorksheet("Revenue");
    sheet.columns = [
      { header: "Month", key: "month", width: 18 },
      { header: "Opportunities Won", key: "count", width: 18 },
      { header: "Revenue", key: "revenue", width: 14 },
    ];
    for (const b of monthBuckets) {
      const dealsInMonth = (won ?? []).filter((o) => {
        const d = new Date(o.closed_at!);
        return d.getFullYear() === b.year && d.getMonth() === b.month;
      });
      sheet.addRow({
        month: b.label,
        count: dealsInMonth.length,
        revenue: dealsInMonth.reduce((sum, o) => sum + (o.value ?? 0), 0),
      });
    }
  } else {
    return NextResponse.json({ error: "Unknown report section." }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="growthos-${section}-report.xlsx"`,
    },
  });
}
