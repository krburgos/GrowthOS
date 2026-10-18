import { NextResponse, type NextRequest } from "next/server";

import { guessMapping, IMPORT_FIELDS, type ImportMapping } from "@/lib/import/fields";
import { parseImportFile } from "@/lib/import/parse";
import { existingContactsByEmail, findRepeats, winningRows, type RepeatedEmail } from "@/lib/import/repeats";
import { applyMapping, validateRows } from "@/lib/import/validate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * Backend Schema §10 — POST /api/import/validate. Parses the uploaded
 * file, applies the given mapping (or a best-guess one if none was
 * provided yet — App Flow §4.4, D4), validates, returns a preview and
 * error report. No writes.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // getCurrentUser resolves a CRO Leader's "viewing as" account (see
  // /api/import/commit); users.account_id is empty for CRO Leader.
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!EDIT_ROLES.includes(profile.role) || !profile.account_id) {
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

  // Repeated emails, for the overwrite / keep choice (client-confirmed,
  // 2026-10-18). Only worked out once the file is otherwise valid.
  let repeats: RepeatedEmail[] = [];
  let validRowCount = mappedRows.length - new Set(errors.map((e) => e.row)).size;
  if (errors.length === 0) {
    let existing: Map<string, string>;
    try {
      existing = await existingContactsByEmail(
        supabase,
        profile.account_id,
        mappedRows.map((r) => r.email)
      );
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    repeats = findRepeats(mappedRows, new Set(existing.keys()));
    // One row is imported per email; the mode only decides which one.
    validRowCount = winningRows(mappedRows, "overwrite").size;
  }

  return NextResponse.json({
    headers: parsed.headers,
    mapping,
    fields: IMPORT_FIELDS,
    totalRows: mappedRows.length,
    validRowCount,
    repeats,
    errors,
    preview: mappedRows.slice(0, 10),
    // Raw, per-original-header sample values (client-confirmed Map
    // Columns redesign) — lets the mapping step show real file content
    // next to each column instead of just its header name.
    rawSamples: parsed.rows.slice(0, 2),
  });
}
