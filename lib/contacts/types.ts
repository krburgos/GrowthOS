export interface ContactListRow {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  score: number | null;
  temperature: "hot" | "cold" | null;
  linkedin_url: string | null;
  email_opt_out: boolean;
  status_id: string;
  contact_statuses: { name: string } | null;
  company_id: string | null;
  companies: {
    name: string;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    company_size: string | null;
    linkedin_url: string | null;
  } | null;
  owner_id: string | null;
  users: { full_name: string } | null;
  updated_at: string;
  last_activity_at?: string | null;
  list_names?: string[];
}

export const CONTACT_SORT_FIELDS = {
  name: "full_name",
  status: "status_id",
  owner: "owner_id",
} as const;

export type ContactSortField = keyof typeof CONTACT_SORT_FIELDS;
