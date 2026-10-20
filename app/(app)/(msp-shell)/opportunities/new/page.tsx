import { redirect } from "next/navigation";

/**
 * The old Create Opportunity page. New Opportunity is now a side panel
 * (client-confirmed, 2026-10-20, approved mockup "New Opportunity Panel"):
 * on the Opportunities page, or on Contact Detail with the contact locked.
 * Old links land on the Opportunities page with the panel open.
 */
export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ contact_id?: string }> }) {
  const { contact_id } = await searchParams;
  redirect(contact_id ? `/contacts/${contact_id}` : "/opportunities?new=1");
}
