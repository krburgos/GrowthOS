import { redirect } from "next/navigation";

import { CAMPAIGNS_HOME } from "@/lib/campaigns/queries";

/**
 * Campaigns moved onto the Email Campaigning Mission Card (client-confirmed,
 * 2026-10-22, approved mockup "Mission Card Workspaces"). This address
 * stays so old links and bookmarks still land on the campaigns.
 */
export default function CampaignsPage() {
  redirect(CAMPAIGNS_HOME);
}
