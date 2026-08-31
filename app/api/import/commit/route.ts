import { NextResponse, type NextRequest } from "next/server";

import type { ImportMapping } from "@/lib/import/fields";
import { parseImportFile } from "@/lib/import/parse";
import { applyMapping, validateRows, type MappedRow } from "@/lib/import/validate";
import { createClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * Backend Schema §10 — POST /api/import/commit. Re-parses and
 * re-validates server-side rather than trusting the client's prior
 * /validate result, then inserts each row, resolving/creating the
 * company via match_or_create_company() (§7.3) and honoring the
 * contacts dedup index (§5.3). Any row failing validation blocks the
 * entire import (App Flow §6) — nothing is written.
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

  if (!(file instanceof File) || typeof mappingRaw !== "string") {
    return NextResponse.json({ error: "Missing file or column mapping." }, { status: 400 });
  }

  const mapping: ImportMapping = JSON.parse(mappingRaw);

  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const mappedRows = applyMapping(parsed.rows, mapping);
  const errors = await validateRows(mappedRows, supabase, profile.account_id);

  if (errors.length > 0) {
    return NextResponse.json({ error: "Import blocked — some rows failed validation.", errors }, { status: 400 });
  }

  const { data: statuses } = await supabase
    .from("contact_statuses")
    .select("id, name, is_default, sort_order")
    .eq("account_id", profile.account_id)
    .is("archived_at", null);

  const statusByName = new Map((statuses ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  const defaultStatus = (statuses ?? [])
    .filter((s) => s.is_default)
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  let imported = 0;
  for (const row of mappedRows as MappedRow[]) {
    let companyId: string | null = null;
    if (row.company_name) {
      const { data: matchedCompanyId, error: matchError } = await supabase.rpc(
        "match_or_create_company",
        {
          p_account_id: profile.account_id,
          p_name: row.company_name,
          p_domain: row.company_website || null,
        }
      );
      if (!matchError && matchedCompanyId) {
        companyId = matchedCompanyId;
        if (row.company_website || row.company_industry || row.company_size || row.company_city || row.company_state) {
          await supabase
            .from("companies")
            .update({
              website: row.company_website || null,
              industry: row.company_industry || null,
              company_size: row.company_size || null,
              city: row.company_city || null,
              state: row.company_state || null,
            })
            .eq("id", companyId);
        }
      }
    }

    const statusId = statusByName.get(row.status.toLowerCase()) ?? defaultStatus?.id;
    if (!statusId) {
      return NextResponse.json(
        { error: "No contact status available for this account — add one in Custom Statuses first." },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("contacts").insert({
      account_id: profile.account_id,
      full_name: row.full_name,
      title: row.title || null,
      email: row.email,
      phone: row.phone || null,
      status_id: statusId,
      company_id: companyId,
      notes: row.notes || null,
      source: "import",
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Import failed at row ${row.rowNumber}: ${insertError.message}`, importedSoFar: imported },
        { status: 400 }
      );
    }
    imported += 1;
  }

  return NextResponse.json({ imported });
}
