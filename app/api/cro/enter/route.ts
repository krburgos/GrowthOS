import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { VIEWING_ACCOUNT_COOKIE, needsAccountSelection } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * App Flow §2.5, §4.10 — "enter" an MSP account from the CRO
 * Leader/Partner Dashboard. Sets the viewing-as cookie that
 * getCurrentUser() resolves into an effective account_id (Milestone
 * 11 note previously in app/(app)/(msp-shell)/layout.tsx: "nothing can
 * trigger this yet" — this route is that trigger). Actual authorization
 * to read/write that account's data is still enforced by RLS
 * (is_cro_leader()/is_partner_for()) on every query — this cookie only
 * decides which account_id the shell's pages resolve to, it grants
 * nothing by itself.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", authUser.id).single();
  if (!profile || !needsAccountSelection(profile.role)) {
    return NextResponse.json({ error: "Only CRO Leader or partner sessions can enter an MSP account." }, { status: 403 });
  }

  const formData = await request.formData();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "accountId is required." }, { status: 400 });
  }

  if (profile.role === "partner") {
    const { data: grant } = await supabase
      .from("partner_account_grants")
      .select("id")
      .eq("partner_user_id", authUser.id)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!grant) {
      return NextResponse.json({ error: "You don't have access to that account." }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEWING_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
}
