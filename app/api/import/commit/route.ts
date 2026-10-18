import { NextResponse, type NextRequest } from "next/server";

import type { ImportMapping } from "@/lib/import/fields";
import { parseImportFile } from "@/lib/import/parse";
import { emailKey, existingContactsByEmail, winningRows, type RepeatMode } from "@/lib/import/repeats";
import { applyMapping, validateRows, type MappedRow } from "@/lib/import/validate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/** The most rows one request imports; the wizard sends batches of this size. */
const MAX_BATCH = 100;

/** Only the cells that have something in them: a blank cell never erases a stored value. */
function filled<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== null && v !== undefined && v !== "")
  ) as Partial<T>;
}

/**
 * Backend Schema §10 — POST /api/import/commit. Re-parses and
 * re-validates server-side rather than trusting the client's prior
 * /validate result, then imports one batch of rows, resolving/creating
 * the company via match_or_create_company() (§7.3) and honoring the
 * contacts dedup index (§5.3). Any row failing validation blocks the
 * entire import (App Flow §6) — nothing is written.
 *
 * Client-confirmed change: a row whose email matches an existing
 * contact updates that contact rather than being rejected. When list_id
 * is present, every imported email — matched or newly created — is also
 * added as a member of that list.
 *
 * Client-confirmed (2026-10-18, approved mockup "Import Repeated Emails"):
 *
 *   - `mode` decides repeats (lib/import/repeats.ts). "overwrite" updates
 *     an existing contact and takes the lower of two rows with one email;
 *     "keep" leaves an existing contact unchanged (it is still added to
 *     the list) and takes the first row. Only the cells that have a value
 *     overwrite, for the contact and its company alike.
 *   - The wizard sends the file in batches (`from`, `to`: 0-based row
 *     indexes, end exclusive) so it can show progress and no request runs
 *     long enough to time out. Which row wins for each email is decided
 *     over the whole file, so batches never write the same email twice.
 *     A batch that fails leaves the batches before it saved; sending the
 *     same batch again is safe.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // getCurrentUser resolves a CRO Leader's "viewing as" account; a CRO
  // Leader has no account_id of their own, so reading users.account_id
  // directly refused every import they tried for an MSP.
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = profile.account_id;
  if (!EDIT_ROLES.includes(profile.role) || !accountId) {
    return NextResponse.json({ error: "You are not authorized to import contacts." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");
  const listIdRaw = formData.get("list_id");
  const listId = typeof listIdRaw === "string" && listIdRaw.length > 0 ? listIdRaw : null;
  const mode: RepeatMode = formData.get("mode") === "keep" ? "keep" : "overwrite";

  if (!(file instanceof File) || typeof mappingRaw !== "string") {
    return NextResponse.json({ error: "Missing file or column mapping." }, { status: 400 });
  }

  if (listId) {
    const { data: list } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("account_id", accountId)
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
  const errors = await validateRows(mappedRows, supabase, accountId);

  if (errors.length > 0) {
    return NextResponse.json({ error: "Import blocked — some rows failed validation.", errors }, { status: 400 });
  }

  const from = Math.max(0, Number(formData.get("from")) || 0);
  const toRaw = Number(formData.get("to"));
  const to = Math.min(mappedRows.length, from + MAX_BATCH, Number.isFinite(toRaw) && toRaw > 0 ? toRaw : Infinity);

  const winners = winningRows(mappedRows, mode);
  const batch = (mappedRows.slice(from, to) as MappedRow[]).filter((r) => winners.has(r.rowNumber));

  const { data: statuses } = await supabase
    .from("contact_statuses")
    .select("id, name, is_default, sort_order")
    .eq("account_id", accountId)
    .is("archived_at", null);

  const statusByName = new Map((statuses ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  const defaultStatus = (statuses ?? [])
    .filter((s) => s.is_default)
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  let existingByEmail: Map<string, string>;
  try {
    existingByEmail = await existingContactsByEmail(
      supabase,
      accountId,
      batch.map((r) => r.email)
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let kept = 0;
  const listContactIds: string[] = [];
  const counts = () => ({ processed: batch.length, imported: created, updated, kept });

  for (const row of batch) {
    const matchedContactId = existingByEmail.get(emailKey(row.email));

    // Keep the current data: the contact, and its company, stay as they are.
    if (matchedContactId && mode === "keep") {
      kept += 1;
      listContactIds.push(matchedContactId);
      continue;
    }

    let companyId: string | null = null;
    if (row.company_name) {
      const { data: matchedCompanyId, error: matchError } = await supabase.rpc("match_or_create_company", {
        p_account_id: accountId,
        p_name: row.company_name,
        p_domain: row.company_website || null,
      });
      if (!matchError && matchedCompanyId) {
        companyId = matchedCompanyId;
        const companyPatch = filled({
          website: row.company_website,
          linkedin_url: row.company_linkedin_url,
          industry: row.company_industry,
          company_size: row.company_size,
          phone: row.company_phone,
          address_line1: row.company_address_line1,
          city: row.company_city,
          state: row.company_state,
        });
        if (Object.keys(companyPatch).length > 0) {
          await supabase.from("companies").update(companyPatch).eq("id", companyId);
        }
      }
    }

    const statusId = row.status ? statusByName.get(row.status.toLowerCase()) ?? defaultStatus?.id : undefined;
    const score = row.score ? Number(row.score) : null;
    const temperature = row.temperature ? (row.temperature.toLowerCase() as "hot" | "cold") : null;

    if (matchedContactId) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update(
          filled({
            first_name: row.first_name,
            last_name: row.last_name,
            title: row.title,
            phone: row.phone,
            score,
            temperature,
            linkedin_url: row.linkedin_url,
            company_id: companyId,
            notes: row.notes,
            status_id: statusId,
          })
        )
        .eq("id", matchedContactId);

      if (updateError) {
        return NextResponse.json(
          { error: `Import failed at row ${row.rowNumber}: ${updateError.message}`, ...counts() },
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
        { error: "No contact status available for this account — add one in Custom Statuses first.", ...counts() },
        { status: 400 }
      );
    }

    const { data: createdContact, error: insertError } = await supabase
      .from("contacts")
      .insert({
        account_id: accountId,
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
        { error: `Import failed at row ${row.rowNumber}: ${insertError?.message}`, ...counts() },
        { status: 400 }
      );
    }
    created += 1;
    existingByEmail.set(emailKey(row.email), createdContact.id);
    listContactIds.push(createdContact.id);
  }

  if (listId && listContactIds.length > 0) {
    const { error: listMembersError } = await supabase.from("list_members").upsert(
      listContactIds.map((contactId) => ({ list_id: listId, contact_id: contactId, added_by: profile.id })),
      { onConflict: "list_id,contact_id", ignoreDuplicates: true }
    );
    if (listMembersError) {
      return NextResponse.json({ error: listMembersError.message, ...counts() }, { status: 400 });
    }
  }

  return NextResponse.json({ ...counts(), addedToList: listContactIds.length, to });
}
