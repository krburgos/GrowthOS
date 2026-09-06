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
 *
 * Client-confirmed change: a row whose email matches an existing
 * contact updates that contact's fields (name, title, phone, score,
 * temperature, LinkedIn, status, company) rather than being rejected
 * (the old plain-import behavior) or silently left untouched (the old
 * list-upload behavior) — one consistent rule everywhere. When list_id
 * is present, every row — matched or newly created — is also added as
 * a member of that list.
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
  const listIdRaw = formData.get("list_id");
  const listId = typeof listIdRaw === "string" && listIdRaw.length > 0 ? listIdRaw : null;

  if (!(file instanceof File) || typeof mappingRaw !== "string") {
    return NextResponse.json({ error: "Missing file or column mapping." }, { status: 400 });
  }

  if (listId) {
    const { data: list } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("account_id", profile.account_id)
      .is("archived_at", null)
      .single();
    if (!list) {
      return NextResponse.json({ error: "That list isn't available to upload contacts into." }, { status: 400 });
    }
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

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, email")
    .eq("account_id", profile.account_id)
    .is("archived_at", null);
  const existingByEmail = new Map((existing ?? []).map((c) => [c.email.toLowerCase(), c.id]));

  let created = 0;
  let updated = 0;
  const listContactIds: string[] = [];

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
        if (
          row.company_website ||
          row.company_linkedin_url ||
          row.company_industry ||
          row.company_size ||
          row.company_phone ||
          row.company_address_line1 ||
          row.company_city ||
          row.company_state
        ) {
          await supabase
            .from("companies")
            .update({
              website: row.company_website || null,
              linkedin_url: row.company_linkedin_url || null,
              industry: row.company_industry || null,
              company_size: row.company_size || null,
              phone: row.company_phone || null,
              address_line1: row.company_address_line1 || null,
              city: row.company_city || null,
              state: row.company_state || null,
            })
            .eq("id", companyId);
        }
      }
    }

    const statusId = row.status ? statusByName.get(row.status.toLowerCase()) ?? defaultStatus?.id : undefined;
    const score = row.score ? Number(row.score) : null;
    const temperature = row.temperature ? (row.temperature.toLowerCase() as "hot" | "cold") : null;

    const matchedContactId = existingByEmail.get(row.email.toLowerCase());

    if (matchedContactId) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: row.first_name,
          last_name: row.last_name || null,
          title: row.title || null,
          phone: row.phone || null,
          score,
          temperature,
          linkedin_url: row.linkedin_url || null,
          company_id: companyId ?? undefined,
          notes: row.notes || null,
          ...(statusId ? { status_id: statusId } : {}),
        })
        .eq("id", matchedContactId);

      if (updateError) {
        return NextResponse.json(
          { error: `Import failed at row ${row.rowNumber}: ${updateError.message}` },
          { status: 400 }
        );
      }
      updated += 1;
      listContactIds.push(matchedContactId);
      continue;
    }

    const resolvedStatusId = statusId ?? defaultStatus?.id;
    if (!resolvedStatusId) {
      return NextResponse.json(
        { error: "No contact status available for this account — add one in Custom Statuses first." },
        { status: 400 }
      );
    }

    const { data: createdContact, error: insertError } = await supabase
      .from("contacts")
      .insert({
        account_id: profile.account_id,
        first_name: row.first_name,
        last_name: row.last_name || null,
        title: row.title || null,
        email: row.email,
        phone: row.phone || null,
        score,
        temperature,
        linkedin_url: row.linkedin_url || null,
        status_id: resolvedStatusId,
        company_id: companyId,
        notes: row.notes || null,
        source: "import",
      })
      .select("id")
      .single();

    if (insertError || !createdContact) {
      return NextResponse.json(
        { error: `Import failed at row ${row.rowNumber}: ${insertError?.message}`, importedSoFar: created },
        { status: 400 }
      );
    }
    created += 1;
    existingByEmail.set(row.email.toLowerCase(), createdContact.id);
    listContactIds.push(createdContact.id);
  }

  if (listId && listContactIds.length > 0) {
    const { error: listMembersError } = await supabase.from("list_members").upsert(
      listContactIds.map((contactId) => ({ list_id: listId, contact_id: contactId, added_by: user.id })),
      { onConflict: "list_id,contact_id", ignoreDuplicates: true }
    );
    if (listMembersError) {
      return NextResponse.json({ error: listMembersError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ imported: created, updated, addedToList: listContactIds.length });
}
