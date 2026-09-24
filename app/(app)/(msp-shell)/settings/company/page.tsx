import { redirect } from "next/navigation";

/**
 * Company Profile moved to Foundation (client-confirmed, 2026-09-24). If the product calls these three foundations and blocks the Command Center until all three are done, keeping one of them in Settings was the inconsistency.
 *
 * Kept rather than deleted: internal links, the notification bell, the
 * invite flow and anyone's bookmarks all point at the old path. Each old
 * path points straight at its final destination rather than hopping
 * through the previous rename.
 */
export default function SettingsCompanyRedirect() {
  redirect("/foundation/company-profile");
}
