import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — POST /api/campaigns/[id]/send. Session, edit
 * role for campaigns (campaigns_update RLS already enforces this — see
 * §6.6). "Send now" and "schedule for later" are the same transition:
 * status -> 'scheduled' with scheduled_at set to now (or a future
 * time) — the already-running send_due_campaigns() cron (every minute)
 * picks it up either way, so there's exactly one send code path
 * (POST /api/campaigns/send-due) rather than a separate immediate-send
 * branch that could drift from the scheduled one.
 */
const sendSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = sendSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
  }

  const { data: campaign } = await supabase.from("campaigns").select("id, status").eq("id", id).single();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Only a draft campaign can be sent or scheduled." }, { status: 400 });
  }

  const scheduledAt = parsed.data.scheduledAt ?? new Date().toISOString();
  if (new Date(scheduledAt).getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Scheduled time can't be in the past." }, { status: 400 });
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Couldn't schedule that campaign — please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
