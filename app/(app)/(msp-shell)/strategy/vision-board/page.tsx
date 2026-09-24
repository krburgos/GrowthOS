import { redirect } from "next/navigation";

/**
 * Strategy was renamed Foundation (client-confirmed, 2026-09-24).
 *
 * Kept rather than deleted: internal links, the notification bell, the
 * invite flow and anyone's bookmarks all point at the old path. Each old
 * path points straight at its final destination rather than hopping
 * through the previous rename.
 */
export default function StrategyVisionBoardRedirect() {
  redirect("/foundation/vision-board");
}
