/**
 * Sortable Contacts columns (client-confirmed, 2026-10-22): every column
 * but Lists (a contact can be in several) sorts on the server, across all
 * contacts, through `sort`/`dir` in the address — the same convention as
 * SortableHeader on Companies, Lists and Opportunities. Shared by the
 * Contacts page and List Detail, which draw the same table.
 *
 * A related column sorts as `companies(name)`, and PostgREST only orders by
 * a related column that the query also selects, so CONTACT_SELECT carries
 * every company column named here.
 */

export const CONTACT_SELECT =
  "id, first_name, last_name, full_name, title, email, phone, score, temperature, linkedin_url, email_opt_out, email_bounced_at, status_id, contact_statuses(name, color), company_id, companies(name, phone, address_line1, city, state, company_size, employee_count, linkedin_url), owner_id, users:users!contacts_owner_id_fkey(full_name), updated_at";

/** Table column key → what it sorts by. Keys match the table's own column keys. */
export const CONTACT_SORTS: Record<string, string> = {
  name: "full_name",
  linkedin: "linkedin_url",
  email: "email",
  title: "title",
  status: "contact_statuses(name)",
  score: "score",
  temp: "temperature",
  pv: "companies(employee_count)",
  ov: "companies(employee_count)",
  employees: "companies(employee_count)",
  company: "companies(name)",
  companyLinkedin: "companies(linkedin_url)",
  cphone: "companies(phone)",
  mobile: "phone",
  addr: "companies(address_line1)",
  city: "companies(city)",
  state: "companies(state)",
  subscribed: "email_opt_out",
  bounced: "email_bounced_at",
  owner: "users(full_name)",
  updated_at: "updated_at",
  // Older links used these names.
  employee_size: "companies(employee_count)",
};

/**
 * Orders a contacts query: the chosen column with blanks last, then id so
 * paging is stable when many rows tie. With no sort chosen it keeps the
 * order the page has always had (updated_at, oldest first).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function orderContacts<Q extends { [k: string]: any }>(query: Q, sort?: string, dir?: string): Q {
  const column = (sort && CONTACT_SORTS[sort]) || "updated_at";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = query;
  return q.order(column, { ascending: dir !== "desc", nullsFirst: false }).order("id", { ascending: true }) as Q;
}
