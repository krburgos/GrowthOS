import { redirect } from "next/navigation";

/**
 * Opportunity Detail is now a side panel (client-confirmed, 2026-10-26,
 * approved mockup "CRM Side Panels"), opened with ?opportunity=<id> over any
 * page. Old links and bookmarks land on the board with it open.
 */
export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/opportunities?opportunity=${encodeURIComponent(id)}`);
}
