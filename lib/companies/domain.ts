/**
 * A website reduced to the domain companies are matched on — the same
 * steps as normalize_company_domain() and match_or_create_company()
 * (Backend Schema §7.3), so the browser can spot a match before saving.
 */
export function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const host = website.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  return host || null;
}
