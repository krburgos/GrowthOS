import { NextResponse, type NextRequest } from "next/server";

import { currentQuarter } from "@/lib/growth-mission/hours";
import { applyOrderMapping, planOrderImport } from "@/lib/growth-mission/order-import";
import { loadOrderImport } from "@/lib/growth-mission/order-import-server";
import type { ImportMapping } from "@/lib/import/fields";
import { createClient } from "@/lib/supabase/server";

/**
 * Import Mission Orders, step 4 (client-confirmed, 2026-10-20). Re-checks
 * the whole file rather than trusting the browser; any error blocks it.
 *
 * Orders are inserted one at a time, in file order: place_mission_order()
 * gives each the next number in its priority group by reading the group's
 * highest, so one statement at a time is what keeps them in sequence after
 * the orders already there. Writes run under the user's session, so RLS and
 * guard_growthmission_orders() apply exactly as in the order panel.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const formData = await request.formData();
  const loaded = await loadOrderImport(slug, formData.get("file"));
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const { ctx } = loaded;

  const mappingRaw = formData.get("mapping");
  if (typeof mappingRaw !== "string") return NextResponse.json({ error: "Missing column mapping." }, { status: 400 });
  const mapping: ImportMapping = JSON.parse(mappingRaw);
  const skipDuplicates = formData.get("skip_duplicates") === "1";

  const report = planOrderImport(applyOrderMapping(ctx.parsed.rows, mapping), ctx);
  if (report.errors.length > 0) {
    return NextResponse.json({ error: "Import blocked — some rows failed validation.", errors: report.errors }, { status: 400 });
  }

  const skipRows = new Set(skipDuplicates ? report.duplicates.map((d) => d.row) : []);
  const supabase = await createClient();
  const dueDefault = currentQuarter().end;
  let created = 0;
  let unassigned = 0;

  for (const order of report.plan) {
    if (skipRows.has(order.rowNumber)) continue;
    const { error } = await supabase.from("growth_mission_tasks").insert({
      account_id: ctx.accountId,
      step_slug: slug,
      title: order.title,
      detail: order.detail,
      priority: order.priority,
      state: order.state,
      hours: order.hours,
      due_date: order.due_date ?? dueDefault,
      delegated: order.delegated,
      assignee_id: order.assignee_id,
    });
    if (error) {
      return NextResponse.json(
        { error: `Import stopped at row ${order.rowNumber}: ${error.message}`, created },
        { status: 400 }
      );
    }
    created += 1;
    if (!order.delegated && !order.assignee_id) unassigned += 1;
  }

  return NextResponse.json({ created, unassigned, skipped: skipRows.size, skippedRows: [...skipRows] });
}
