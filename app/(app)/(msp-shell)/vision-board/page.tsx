import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VisionPage } from "@/components/vision-board/vision-page";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vision Board — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * The completed Vision Board, on its own full-width route
 * (client-confirmed, 2026-09-22). It used to render inside
 * /settings/vision-board, docked beside the Settings nav panel, which
 * fought a full-bleed page - hence "it should break out".
 *
 * Settings keeps the wizard and remains the one place the board is
 * edited; a completed board redirects from there to here, and "Edit"
 * sends you back with ?edit=1.
 *
 * Everyone in the account can read this, which the existing
 * vision_board_responses_select policy already allows - no policy change.
 * An incomplete board has nothing to show, so it redirects into the
 * wizard instead of rendering a page full of gaps.
 */
export default async function VisionBoardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const supabase = await createClient();
  const [{ data: response }, { data: account }] = await Promise.all([
    supabase
      .from("vision_board_responses")
      .select("answers, completed_at")
      .eq("account_id", user.account_id)
      .maybeSingle(),
    supabase.from("accounts").select("id, name, logo_url").eq("id", user.account_id).maybeSingle(),
  ]);

  if (!account) return null;
  if (!response?.completed_at) redirect("/settings/vision-board");

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 md:p-8">
      <VisionPage
        account={account}
        answers={(response.answers as Record<string, string | string[] | null>) ?? {}}
        canEdit={EDIT_ROLES.includes(user.role)}
      />
    </main>
  );
}
