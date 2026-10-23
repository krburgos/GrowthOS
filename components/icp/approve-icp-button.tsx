"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { icpSnapshot } from "@/lib/icp/rules";
import { createClient } from "@/lib/supabase/client";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

/**
 * Signs the viewer's slot on the ICP (client-confirmed, 2026-10-23: an MSP
 * Owner and a CRO Admin both approve). Each click is a new icp_approvals
 * row holding the answers it approved; RLS lets each role sign only its
 * own slot.
 */
export function ApproveIcpButton({
  accountId,
  role,
  answers,
}: {
  accountId: string;
  role: "msp_owner" | "cro_admin";
  answers: Record<string, unknown>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const approve = async () => {
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("icp_approvals").insert({
      account_id: accountId,
      approved_by: user!.id,
      approver_role: role,
      answers: icpSnapshot(answers),
    });
    setPending(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("ICP approved.");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={approve}
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3.5 text-body-sm font-semibold text-primary-900 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 disabled:opacity-60"
    >
      <Check className="size-4" />
      {pending ? "Approving…" : "Approve ICP"}
    </button>
  );
}
