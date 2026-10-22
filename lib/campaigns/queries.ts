import type { CampaignRow } from "@/components/campaigns/campaigns-table";
import { createClient } from "@/lib/supabase/server";

export const CAMPAIGN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/** Where Campaigns lives since 2026-10-22: on the Email Campaigning Mission Card. */
export const CAMPAIGNS_HOME = "/growth-mission/email-campaigning";

export const EMAIL_CAMPAIGNING_SLUG = "email-campaigning";

/**
 * Every campaign with its recipient stats, newest first. Moved here from
 * the old Campaigns Index (App Flow §4.7, G1) when Campaigns moved onto the
 * Email Campaigning Mission Card (client-confirmed, 2026-10-22).
 */
export async function getCampaignRows(): Promise<CampaignRow[]> {
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

  return (campaignRows ?? []).map((c) => {
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
}
