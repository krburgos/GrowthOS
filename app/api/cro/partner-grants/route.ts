import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * CRO Admin manages which MSP accounts a partner can see
 * (partner_account_grants, Backend Schema §5.2's partner addition,
 * 2026-09-08). The session-scoped client is enough here — the
 * partner_account_grants RLS policies already restrict insert/delete
 * to cro_admin, so there's no secret involved (Backend Schema §11).
 */
const grantSchema = z.object({
  partnerUserId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = grantSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a partner and an account." }, { status: 400 });
  }

  const { error } = await supabase.from("partner_account_grants").insert({
    partner_user_id: parsed.data.partnerUserId,
    account_id: parsed.data.accountId,
    granted_by: authUser.id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "That partner already has access to this account." : "Couldn't add that grant." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = grantSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a partner and an account." }, { status: 400 });
  }

  const { error } = await supabase
    .from("partner_account_grants")
    .delete()
    .eq("partner_user_id", parsed.data.partnerUserId)
    .eq("account_id", parsed.data.accountId);

  if (error) {
    return NextResponse.json({ error: "Couldn't remove that grant." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
