import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignRecipientsTable, type RecipientRow } from "@/components/campaigns/campaign-recipients-table";
import { Badge } from "@/components/ui/badge";
import { SendCampaignControls } from "@/components/campaigns/send-campaign-controls";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Campaign — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

const STATUS_BADGE: Record<string, "neutral" | "info" | "success" | "error"> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  sent: "success",
  failed: "error",
  cancelled: "neutral",
};

/** App Flow §4.7 (G2), approved mockup (2026-09-08) — Campaign Detail. */
export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, scheduled_at, sent_at, list_id, lists(name), users!created_by(full_name), email_connections!send_from_connection_id(email_address)"
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!campaign) notFound();

  const { data: recipientRows } = await supabase
    .from("campaign_recipients")
    .select("id, status, sent_at, first_opened_at, first_clicked_at, contacts(full_name, email)")
    .eq("campaign_id", id)
    .order("sent_at", { ascending: true, nullsFirst: false });

  const recipients: RecipientRow[] = (recipientRows ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id,
      contactName: contact?.full_name ?? "Unknown",
      contactEmail: contact?.email ?? "",
      status: r.status,
      openedAt: r.first_opened_at,
      clickedAt: r.first_clicked_at,
      sentAt: r.sent_at,
    };
  });

  const total = recipients.length;
  const delivered = recipients.filter((r) => r.status === "sent" || r.status === "unsubscribed").length;
  const opened = recipients.filter((r) => r.openedAt).length;
  const clicked = recipients.filter((r) => r.clickedAt).length;
  const bounced = recipients.filter((r) => r.status === "bounced").length;
  const unsubscribed = recipients.filter((r) => r.status === "unsubscribed").length;
  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—");

  const list = Array.isArray(campaign.lists) ? campaign.lists[0] : campaign.lists;
  const creator = Array.isArray(campaign.users) ? campaign.users[0] : campaign.users;
  const fromConnection = Array.isArray(campaign.email_connections) ? campaign.email_connections[0] : campaign.email_connections;
  const canEdit = EDIT_ROLES.includes(user.role);

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex items-center gap-2 text-caption text-neutral-500">
        <Link href="/campaigns" className="font-semibold text-secondary-700 hover:underline">
          Campaigns
        </Link>
        <span>/</span>
        <span>{campaign.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-h1 text-primary-900">{campaign.name}</h1>
            <Badge variant={STATUS_BADGE[campaign.status]}>{campaign.status[0].toUpperCase() + campaign.status.slice(1)}</Badge>
          </div>
          <p className="mt-1 text-body-sm text-neutral-500">
            {campaign.sent_at
              ? `Sent ${new Date(campaign.sent_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
              : campaign.scheduled_at
                ? `Scheduled for ${new Date(campaign.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                : "Not sent yet"}
            {" · To "}
            <b className="text-neutral-700">{list?.name ?? "—"}</b>
            {" ("}
            {total} contacts{")"}
            {" · From "}
            {fromConnection?.email_address ?? creator?.full_name ?? "—"}
          </p>
        </div>
        {canEdit && campaign.status === "draft" && <SendCampaignControls campaignId={campaign.id} />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">{total}</p>
          <p className="text-caption text-neutral-500">Recipients</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">
            {delivered} <span className="text-caption font-semibold text-neutral-400">{pct(delivered)}</span>
          </p>
          <p className="text-caption text-neutral-500">Delivered</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">
            {opened} <span className="text-caption font-semibold text-neutral-400">{pct(opened)}</span>
          </p>
          <p className="text-caption text-neutral-500">Opened</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-primary-900">
            {clicked} <span className="text-caption font-semibold text-neutral-400">{pct(clicked)}</span>
          </p>
          <p className="text-caption text-neutral-500">Clicked</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-error-700">
            {bounced} <span className="text-caption font-semibold text-neutral-400">{pct(bounced)}</span>
          </p>
          <p className="text-caption text-neutral-500">Bounced</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h3 font-bold tabular-nums text-warning-700">
            {unsubscribed} <span className="text-caption font-semibold text-neutral-400">{pct(unsubscribed)}</span>
          </p>
          <p className="text-caption text-neutral-500">Unsubscribed</p>
        </div>
      </div>

      <CampaignRecipientsTable recipients={recipients} />
    </main>
  );
}
