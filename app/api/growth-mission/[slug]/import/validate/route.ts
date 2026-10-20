import { NextResponse, type NextRequest } from "next/server";

import { ORDER_IMPORT_FIELDS, applyOrderMapping, planOrderImport } from "@/lib/growth-mission/order-import";
import { loadOrderImport } from "@/lib/growth-mission/order-import-server";
import { guessMapping, type ImportMapping } from "@/lib/import/fields";

/**
 * Import Mission Orders, steps 2–3 (client-confirmed, 2026-10-20): parse the
 * file, apply the mapping (or a best guess on the first pass), and report
 * errors, warnings and a preview. Writes nothing.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const formData = await request.formData();
  const loaded = await loadOrderImport(slug, formData.get("file"));
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const { ctx } = loaded;

  const mappingRaw = formData.get("mapping");
  const mapping: ImportMapping =
    typeof mappingRaw === "string" && mappingRaw ? JSON.parse(mappingRaw) : guessMapping(ctx.parsed.headers, ORDER_IMPORT_FIELDS);

  const rows = applyOrderMapping(ctx.parsed.rows, mapping);
  const report = planOrderImport(rows, ctx);

  return NextResponse.json({
    headers: ctx.parsed.headers,
    mapping,
    fields: ORDER_IMPORT_FIELDS,
    totalRows: rows.length,
    errors: report.errors,
    unknownOwners: report.unknownOwners,
    overCapacity: report.overCapacity,
    duplicates: report.duplicates,
    validCount: report.plan.length,
    preview: report.plan.slice(0, 12).map((p) => ({
      title: p.title,
      priority: p.priority,
      owner: p.ownerName,
      hours: p.hours,
    })),
    rawSamples: ctx.parsed.rows.slice(0, 2),
  });
}
