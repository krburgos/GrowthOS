import type { SupabaseClient } from "@supabase/supabase-js";

import type { MappedRow } from "@/lib/import/validate";

/**
 * Repeated emails on import (client-confirmed, 2026-10-18, approved mockup
 * "Import Repeated Emails"). A repeated email no longer blocks the file;
 * the user picks one rule for both kinds of repeat:
 *
 *   - "overwrite": the file wins over an existing contact, and the lower
 *     row wins when the file repeats an email;
 *   - "keep": an existing contact is left exactly as it is, and the first
 *     row wins when the file repeats an email.
 *
 * Either way, a blank cell never erases a value already on the contact.
 */
export type RepeatMode = "overwrite" | "keep";

export interface RepeatedEmail {
  email: string;
  /** Every row in the file carrying this email, in file order. */
  rows: number[];
  /** Already a contact in this account. */
  existing: boolean;
}

/** Emails compare the way contacts_account_email_unique does: ignoring case. */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The row numbers that are actually imported: one per email. Deciding this
 * over the whole file, rather than per batch, is what lets each batch be
 * imported on its own without two batches writing the same email.
 */
export function winningRows(rows: MappedRow[], mode: RepeatMode): Set<number> {
  const pick = new Map<string, number>();
  for (const row of rows) {
    if (!row.email) continue;
    const key = emailKey(row.email);
    if (mode === "overwrite" || !pick.has(key)) pick.set(key, row.rowNumber);
  }
  return new Set(pick.values());
}

/** Emails that appear on more than one row, or that already belong to a contact. */
export function findRepeats(rows: MappedRow[], existingKeys: Set<string>): RepeatedEmail[] {
  const byKey = new Map<string, RepeatedEmail>();
  for (const row of rows) {
    if (!row.email) continue;
    const key = emailKey(row.email);
    const entry = byKey.get(key);
    if (entry) entry.rows.push(row.rowNumber);
    else byKey.set(key, { email: row.email, rows: [row.rowNumber], existing: existingKeys.has(key) });
  }
  return [...byKey.values()].filter((r) => r.rows.length > 1 || r.existing).sort((a, b) => a.rows[0] - b.rows[0]);
}

/** Which of these emails already belong to a contact in the account, keyed by emailKey. */
export async function existingContactsByEmail(
  supabase: SupabaseClient,
  accountId: string,
  emails: string[]
): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();
  const { data, error } = await supabase.rpc("find_contacts_by_email", {
    p_account_id: accountId,
    p_emails: emails,
  });
  if (error) throw error;
  return new Map(((data ?? []) as { id: string; email_key: string }[]).map((r) => [r.email_key, r.id]));
}
