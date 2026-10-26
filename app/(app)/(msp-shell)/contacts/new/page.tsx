import { redirect } from "next/navigation";

/**
 * Add Contact is now a side panel (client-confirmed, 2026-10-26, approved
 * mockup "CRM Side Panels"). Old links land on Contacts with it open, or on
 * the company with its Add Contact open when one was named.
 */
export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ company_id?: string }> }) {
  const { company_id: companyId } = await searchParams;
  redirect(companyId ? `/companies/${encodeURIComponent(companyId)}?add_contact=1` : "/contacts?new=1");
}
