"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * App Flow §2.5, Design System §8.10 — CRO Leader "viewing as" banner.
 * warning-400 bg + black text (the one deliberate non-badge use of
 * warning-yellow), 40px height, company name left, "Exit to My
 * Dashboard" ghost button right (placement inside the banner per §2.5).
 *
 * Nothing can trigger this yet — entering an MSP account is Milestone
 * 11 — but the component is built now per Milestone 5's scope.
 */
export function CroLeaderBanner({ companyName }: { companyName: string }) {
  return (
    <div className="flex h-[var(--banner-height)] shrink-0 items-center justify-between bg-warning-400 px-4 text-body-sm text-black">
      <span>
        Viewing: <strong className="font-medium">{companyName}</strong> — you are inside this
        account on behalf of the MSP.
      </span>
      <Button asChild variant="ghost" size="sm" className="text-black hover:bg-black/10">
        <Link href="/cro">Exit to My Dashboard</Link>
      </Button>
    </div>
  );
}
