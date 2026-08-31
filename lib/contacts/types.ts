export interface ContactListRow {
  id: string;
  full_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  status_id: string;
  contact_statuses: { name: string } | null;
  company_id: string | null;
  companies: { name: string; city: string | null; state: string | null; company_size: string | null } | null;
  owner_id: string | null;
  users: { full_name: string } | null;
  updated_at: string;
  last_activity_at?: string | null;
}

export const CONTACT_SORT_FIELDS = {
  name: "full_name",
  status: "status_id",
  owner: "owner_id",
} as const;

export type ContactSortField = keyof typeof CONTACT_SORT_FIELDS;
