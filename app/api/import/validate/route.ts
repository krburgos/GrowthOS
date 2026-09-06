import { NextResponse, type NextRequest } from "next/server";

import { guessMapping, IMPORT_FIELDS, type ImportMapping } from "@/lib/import/fields";
import { parseImportFile } from "@/lib/import/parse";
import { applyMapping, validateRows } from "@/lib/import/validate";
import { createClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * Backend Schema §10 — POST /api/import/validate. Parses the uploaded
 * file, applies the given mapping (or a best-guess one if none was
 * provided yet — App Flow §4.4, D4), validates, returns a preview and
 * error report. No writes.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, account_id")
    .eq("id", user.id)
    .single();

  if (!profile || !EDIT_ROLES.includes(profile.role) || !profile.account_id) {
    return NextResponse.json({ error: "You are not authorized to import contacts." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const mapping: ImportMapping =
    typeof mappingRaw === "string" && mappingRaw ? JSON.parse(mappingRaw) : guessMapping(parsed.headers);

  const mappedRows = applyMapping(parsed.rows, mapping);
  const errors = await validateRows(mappedRows, supabase, profile.account_id);

  return NextResponse.json({
    headers: parsed.headers,
    mapping,
    fields: IMPORT_FIELDS,
    totalRows: mappedRows.length,
    validRowCount: mappedRows.length - new Set(errors.map((e) => e.row)).size,
    errors,
    preview: mappedRows.slice(0, 10),
    // Raw, per-original-header sample values (client-confirmed Map
    // Columns redesign) — lets the mapping step show real file content
    // next to each column instead of just its header name.
    rawSamples: parsed.rows.slice(0, 2),
  });
}
