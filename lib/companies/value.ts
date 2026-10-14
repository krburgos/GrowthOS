/**
 * The client's company-size formulas (client-confirmed, 2026-09-15,
 * Design System §8.5), in one place so Contacts, Contact Detail,
 * Opportunities, Companies and Lists can never compute them differently:
 *
 *   Prospect Value      = $200 × Employees × 12
 *   Opportunities Value = 3 × Prospect Value
 *
 * Employees is `companies.company_size`, free text in the schema, so
 * anything that isn't a number counts as 0 rather than erroring.
 */

export function employeesOf(companySize: string | number | null | undefined): number {
  const n = Number(companySize);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function prospectValue(companySize: string | number | null | undefined): number {
  return 200 * employeesOf(companySize) * 12;
}

export function opportunitiesValue(companySize: string | number | null | undefined): number {
  return prospectValue(companySize) * 3;
}

/** Whole dollars, no cents: "$204,000". */
export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Compact for totals: "$8.4M", "$612k". */
export function usdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return usd.format(n);
}

/** "Today", "1d", "12d": how long since a stage was entered. */
export function daysSince(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : `${days}d`;
}
