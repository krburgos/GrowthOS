"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Client-confirmed (2026-09-08) — Campaign Detail's send action for a
 * draft campaign. "Send Now" and "Schedule" both call the same
 * POST /api/campaigns/[id]/send route (Backend Schema §10) — the only
 * difference is whether scheduledAt is omitted (now) or a chosen future
 * time, since the send_due_campaigns() cron (running every minute)
 * handles both identically once the campaign's status is 'scheduled'.
 */
export function SendCampaignControls({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [pending, setPending] = useState(false);

  const send = async (isoScheduledAt?: string) => {
    setPending(true);
    const res = await fetch(`/api/campaigns/${campaignId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isoScheduledAt ? { scheduledAt: isoScheduledAt } : {}),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't send that campaign — please try again.");
      return;
    }

    toast.success(isoScheduledAt ? "Campaign scheduled." : "Campaign is sending now.");
    router.refresh();
  };

  if (scheduling) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-56"
        />
        <Button
          type="button"
          disabled={pending || !scheduledAt}
          onClick={() => send(new Date(scheduledAt).toISOString())}
        >
          {pending ? "Scheduling…" : "Confirm Schedule"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setScheduling(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" onClick={() => setScheduling(true)} disabled={pending}>
        Schedule for Later
      </Button>
      <Button type="button" onClick={() => send()} disabled={pending}>
        {pending ? "Sending…" : "Send Now"}
      </Button>
    </div>
  );
}
