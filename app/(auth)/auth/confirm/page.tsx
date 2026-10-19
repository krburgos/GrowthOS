import type { Metadata } from "next";

import { LinkConfirm } from "@/components/auth/link-confirm";

export const metadata: Metadata = { title: "Confirm — GrowthMission" };

/** Invite and password-reset links land here first; see LinkConfirm. */
export default function ConfirmPage() {
  return <LinkConfirm />;
}
