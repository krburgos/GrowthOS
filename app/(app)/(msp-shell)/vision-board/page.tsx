import { redirect } from "next/navigation";

/**
 * The Vision Board's finished view briefly lived here on its own; it now sits in Strategy with its editor, so the document has one address (client-confirmed, 2026-09-24).
 *
 * Kept rather than deleted: the Dashboard's setup block, the Command
 * Center's readiness strip, the notification bell and the invite flow all
 * linked here, and so does anything anyone bookmarked. A redirect costs one
 * file; a 404 costs trust.
 */
export default function VisionBoardLegacyRedirect() {
  redirect("/strategy/vision-board");
}
