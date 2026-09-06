import type { SupabaseClient } from "@supabase/supabase-js";

export interface MappedRow {
  rowNumber: number; // 1-based, matching the spreadsheet's data rows (header excluded)
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  phone: string;
  status: string;
  score: string;
  temperature: string;
  linkedin_url: string;
  company_name: string;
  company_website: string;
  company_linkedin_url: string;
  company_industry: string;
  company_size: string;
  company_phone: string;
  company_address_line1: string;
  company_city: string;
  company_state: string;
  notes: string;
}

export interface ImportError {
  row: number;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function applyMapping(rows: Record<string, string>[], mapping: Record<string, string | null>): MappedRow[] {
  return rows.map((raw, index) => {
    const get = (fieldKey: string) => {
      const header = mapping[fieldKey];
      return header ? (raw[header] ?? "").trim() : "";
    };
    return {
      rowNumber: index + 1,
      first_name: get("first_name"),
      last_name: get("last_name"),
      email: get("email"),
      title: get("title"),
      phone: get("phone"),
      status: get("status"),
      score: get("score"),
      temperature: get("temperature"),
      linkedin_url: get("linkedin_url"),
      company_name: get("company_name"),
      company_website: get("company_website"),
      company_linkedin_url: get("company_linkedin_url"),
      company_industry: get("company_industry"),
      company_size: get("company_size"),
      company_phone: get("company_phone"),
      company_address_line1: get("company_address_line1"),
      company_city: get("company_city"),
      company_state: get("company_state"),
      notes: get("notes"),
    };
  });
}

/**
 * App Flow §4.4, D4 + §6 — any validation failure blocks the entire
 * import: missing required fields, invalid formats, and (a mechanical
 * necessity the doc doesn't call out separately) duplicate emails
 * within the file itself.
 *
 * Client-confirmed change: an email matching an existing contact is no
 * longer a validation error anywhere (plain Import Contacts or list
 * uploads) — the commit step updates that contact's fields instead of
 * rejecting the file or creating a duplicate.
 */
export async function validateRows(
  mappedRows: MappedRow[],
  _supabase: SupabaseClient,
  _accountId: string
): Promise<ImportError[]> {
  const errors: ImportError[] = [];
  const seenInFile = new Map<string, number>();

  for (const row of mappedRows) {
    if (!row.first_name) {
      errors.push({ row: row.rowNumber, message: "Missing required field: First Name." });
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
    if (row.score && !/^-?\d+$/.test(row.score)) {
      errors.push({ row: row.rowNumber, message: `Score must be a whole number: ${row.score}` });
    }
    if (row.temperature && !["hot", "cold"].includes(row.temperature.toLowerCase())) {
      errors.push({ row: row.rowNumber, message: `Temp must be "Hot" or "Cold": ${row.temperature}` });
    }
  }

  return errors.sort((a, b) => a.row - b.row);
}
