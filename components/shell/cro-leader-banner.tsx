import { Button } from "@/components/ui/button";

/**
 * App Flow §2.5, Design System §8.10 — CRO Leader "viewing as" banner.
 * warning-400 bg + black text (the one deliberate non-badge use of
 * warning-yellow), 40px height, company name left, "Exit to My
 * Dashboard" ghost button right (placement inside the banner per §2.5).
 *
 * Client-confirmed addition (2026-09-08): Exit is a form POST to
 * /api/cro/exit rather than a plain Link — it needs to actually clear
 * the viewing-as cookie (lib/auth/get-current-user.ts), not just
 * navigate, or the next visit to the MSP shell would silently resume
 * viewing the same account.
 */
export function CroLeaderBanner({ companyName }: { companyName: string }) {
  return (
    <div className="flex h-[var(--banner-height)] shrink-0 items-center justify-between bg-warning-400 px-4 text-body-sm text-black">
      <span>
        Viewing: <strong className="font-medium">{companyName}</strong> — you are inside this
        account on behalf of the MSP.
      </span>
      <form action="/api/cro/exit" method="post">
        <Button type="submit" variant="ghost" size="sm" className="text-black hover:bg-black/10">
          Exit to My Dashboard
        </Button>
      </form>
    </div>
  );
}
