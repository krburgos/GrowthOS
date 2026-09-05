import type { SupabaseClient } from "@supabase/supabase-js";

import { IMPORT_FIELDS, type ImportMapping } from "@/lib/import/fields";

export interface MappedRow {
  rowNumber: number; // 1-based, matching the spreadsheet's data rows (header excluded)
  full_name: string;
  email: string;
  title: string;
  phone: string;
  status: string;
  company_name: string;
  company_website: string;
  company_industry: string;
  company_size: string;
  company_city: string;
  company_state: string;
  notes: string;
}

export interface ImportError {
  row: number;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function applyMapping(rows: Record<string, string>[], mapping: ImportMapping): MappedRow[] {
  return rows.map((raw, index) => {
    const get = (fieldKey: string) => {
      const header = mapping[fieldKey];
      return header ? (raw[header] ?? "").trim() : "";
    };
    return {
      rowNumber: index + 1,
      full_name: get("full_name"),
      email: get("email"),
      title: get("title"),
      phone: get("phone"),
      status: get("status"),
      company_name: get("company_name"),
      company_website: get("company_website"),
      company_industry: get("company_industry"),
      company_size: get("company_size"),
      company_city: get("company_city"),
      company_state: get("company_state"),
      notes: get("notes"),
    };
  });
}

/**
 * App Flow §4.4, D4 + §6 — any validation failure blocks the entire
 * import: missing required fields, duplicate emails against existing
 * contacts, and (a mechanical necessity the doc doesn't call out
 * separately) duplicate emails within the file itself.
 *
 * Client-confirmed exception for uploading a list (lib/import/commit's
 * list_id path): an email matching an existing contact is expected and
 * useful there — that row gets matched to the existing contact and
 * added to the list rather than blocking the whole file. Pass
 * `allowExistingEmails: true` to skip that one check; everything else
 * (required fields, format, in-file duplicates) still applies.
 */
export async function validateRows(
  mappedRows: MappedRow[],
  supabase: SupabaseClient,
  accountId: string,
  options?: { allowExistingEmails?: boolean }
): Promise<ImportError[]> {
  const errors: ImportError[] = [];
  const seenInFile = new Map<string, number>();

  for (const row of mappedRows) {
    if (!row.full_name) {
      errors.push({ row: row.rowNumber, message: "Missing required field: Full Name." });
    }
    if (!row.email) {
      errors.push({ row: row.rowNumber, message: "Missing required field: Email." });
    } else if (!EMAIL_RE.test(row.email)) {
      errors.push({ row: row.rowNumber, message: `Invalid email address: ${row.email}` });
    } else {
      const key = row.email.toLowerCase();
      if (seenInFile.has(key)) {
        errors.push({
          row: row.rowNumber,
          message: `Duplicate email within this file (also row ${seenInFile.get(key)}): ${row.email}`,
        });
      } else {
        seenInFile.set(key, row.rowNumber);
      }
    }
  }

  const emailsToCheck = !options?.allowExistingEmails && mappedRows.some((r) => r.email && EMAIL_RE.test(r.email));

  if (emailsToCheck) {
    // contacts_account_email_unique (Backend Schema §5.3) is
    // case-insensitive (`lower(email)`) — .in() isn't, so the comparison
    // is done in JS against every existing email for the account rather
    // than risk a false negative on a casing mismatch.
    const { data: existing } = await supabase
      .from("contacts")
      .select("email")
      .eq("account_id", accountId)
      .is("archived_at", null);

    const existingEmails = new Set((existing ?? []).map((r) => r.email.toLowerCase()));
    for (const row of mappedRows) {
      if (row.email && existingEmails.has(row.email.toLowerCase())) {
        errors.push({
          row: row.rowNumber,
          message: `A contact with this email already exists in GrowthOS: ${row.email}`,
        });
      }
    }
  }

  return errors.sort((a, b) => a.row - b.row);
}

export const REQUIRED_FIELD_KEYS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
