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
