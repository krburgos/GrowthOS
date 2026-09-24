export interface CompanyProfile {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  linkedin_url: string | null;
  phone: string | null;
  ceo_name: string | null;
  sales_marketing_names: string[];
  address_street: string | null;
  address_suite: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
}

/** The columns the Dashboard card and Settings form both read. */
export const COMPANY_PROFILE_COLUMNS =
  "id, name, logo_url, website, linkedin_url, phone, ceo_name, sales_marketing_names, address_street, address_suite, address_city, address_state, address_zip";

/** "1200 Peachtree St NE, Suite 400, Atlanta, GA 30309" — skipping whatever isn't filled in. */
export function formatAddress(a: Pick<CompanyProfile, "address_street" | "address_suite" | "address_city" | "address_state" | "address_zip">): string {
  const cityLine = [[a.address_city, a.address_state].filter(Boolean).join(", "), a.address_zip].filter(Boolean).join(" ");
  return [a.address_street, a.address_suite, cityLine].map((part) => part?.trim()).filter(Boolean).join(", ");
}

/** Website/LinkedIn are stored as typed — show them without the scheme, open them with one. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/**
 * Profile completeness (client-confirmed, 2026-09-24) — the eleven fields
 * the Dashboard's Company Profile card scores itself against.
 *
 * Suite is deliberately not one of them: plenty of companies do not have
 * one, so counting it would leave those accounts permanently short of
 * complete for no reason. Everything else is expected of every account, so
 * anything missing is a genuine gap worth naming.
 *
 * The labels are what the card lists under "Missing:", so they read as
 * things to go and add rather than as column names.
 */
export const COMPLETENESS_FIELDS: { label: string; filled: (a: CompanyProfile, teamCount?: number) => boolean }[] = [
  { label: "logo", filled: (a) => !!a.logo_url },
  { label: "company name", filled: (a) => !!a.name?.trim() },
  { label: "street", filled: (a) => !!a.address_street?.trim() },
  { label: "city", filled: (a) => !!a.address_city?.trim() },
  { label: "state", filled: (a) => !!a.address_state?.trim() },
  { label: "ZIP", filled: (a) => !!a.address_zip?.trim() },
  { label: "phone", filled: (a) => !!a.phone?.trim() },
  { label: "website", filled: (a) => !!a.website?.trim() },
  { label: "LinkedIn", filled: (a) => !!a.linkedin_url?.trim() },
  { label: "CEO", filled: (a) => !!a.ceo_name?.trim() },
  // Counted from the account_team_members roster (2026-09-24), not the
  // old sales_marketing_names array, which the roster replaced.
  { label: "a Sales & Marketing person", filled: (_a, teamCount) => (teamCount ?? 0) > 0 },
];

export interface Completeness {
  filled: number;
  total: number;
  missing: string[];
  complete: boolean;
}

export function profileCompleteness(account: CompanyProfile, teamCount = 0): Completeness {
  const missing = COMPLETENESS_FIELDS.filter((f) => !f.filled(account, teamCount)).map((f) => f.label);
  return {
    filled: COMPLETENESS_FIELDS.length - missing.length,
    total: COMPLETENESS_FIELDS.length,
    missing,
    complete: missing.length === 0,
  };
}
