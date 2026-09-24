import { redirect } from "next/navigation";

/**
 * The Vision Board's finished view briefly had its own top-level route; it now sits in Foundation with its editor, so the document has one address.
 *
 * Kept rather than deleted: internal links, the notification bell, the
 * invite flow and anyone's bookmarks all point at the old path. Each old
 * path points straight at its final destination rather than hopping
 * through the previous rename.
 */
export default function VisionBoardLegacyRedirect() {
  redirect("/foundation/vision-board");
}
