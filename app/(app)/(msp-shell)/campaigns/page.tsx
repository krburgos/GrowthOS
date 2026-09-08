import type { Metadata } from "next";
import Link from "next/link";

import { CampaignsTable, type CampaignRow } from "@/components/campaigns/campaigns-table";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Campaigns — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.7 (G1), Implementation Plan Milestone 10 — Campaigns
 * Index. Client-confirmed "Data Table" concept (approved mockup,
 * 2026-09-08): navy-header table matching every other list screen,
 * open/click rate as compact inline meters, a KPI strip above it
 * mirroring the Dashboard/Company Detail stat-row pattern.
 */
export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("id, name, status, scheduled_at, sent_at, created_at, lists(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const campaignIds = (campaignRows ?? []).map((c) => c.id);
  const { data: recipientRows } =
    campaignIds.length > 0
      ? await supabase.from("campaign_recipients").select("campaign_id, status, open_count, click_count").in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string; status: string; open_count: number; click_count: number }[] };

  const statsByCampaign = new Map<string, { total: number; sent: number; opened: number; clicked: number }>();
  for (const r of recipientRows ?? []) {
    const s = statsByCampaign.get(r.campaign_id) ?? { total: 0, sent: 0, opened: 0, clicked: 0 };
    s.total += 1;
    if (r.status === "sent") s.sent += 1;
    if ((r.open_count ?? 0) > 0) s.opened += 1;
    if ((r.click_count ?? 0) > 0) s.clicked += 1;
    statsByCampaign.set(r.campaign_id, s);
  }

  const campaigns: CampaignRow[] = (campaignRows ?? []).map((c) => {
    const list = Array.isArray(c.lists) ? c.lists[0] : c.lists;
    const stats = statsByCampaign.get(c.id) ?? { total: 0, sent: 0, opened: 0, clicked: 0 };
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      listName: list?.name ?? "—",
      recipients: stats.total,
      openRate: stats.sent > 0 ? stats.opened / stats.sent : null,
      clickRate: stats.sent > 0 ? stats.clicked / stats.sent : null,
      date: c.sent_at ?? c.scheduled_at ?? c.created_at,
      dateLabel: c.sent_at ? "Sent" : c.scheduled_at ? "Scheduled" : "Created",
    };
  });

  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const avgOpen =
    sentCampaigns.length > 0 ? sentCampaigns.reduce((sum, c) => sum + (c.openRate ?? 0), 0) / sentCampaigns.length : 0;
  const avgClick =
    sentCampaigns.length > 0 ? sentCampaigns.reduce((sum, c) => sum + (c.clickRate ?? 0), 0) / sentCampaigns.length : 0;
  const scheduledCount = campaigns.filter((c) => c.status === "scheduled").length;

  const canEdit = EDIT_ROLES.includes(user.role);

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">Campaigns</h1>
          <p className="text-body text-neutral-500">Send, schedule, and track email campaigns to your lists.</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/campaigns/new">New Campaign</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">{sentCampaigns.length}</p>
          <p className="text-caption text-neutral-500">Campaigns Sent</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">{(avgOpen * 100).toFixed(1)}%</p>
          <p className="text-caption text-neutral-500">Avg. Open Rate</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">{(avgClick * 100).toFixed(1)}%</p>
          <p className="text-caption text-neutral-500">Avg. Click Rate</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">{scheduledCount}</p>
          <p className="text-caption text-neutral-500">Scheduled</p>
        </div>
      </div>

      <CampaignsTable campaigns={campaigns} />
    </main>
  );
}
