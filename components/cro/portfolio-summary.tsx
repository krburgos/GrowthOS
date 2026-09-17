import { HeroBand, HeroLabel } from "@/components/shell/hero-band";
import { formatHours, quarterPct, type QuarterInfo } from "@/lib/gos-dashboard/hours";
import type { CroAccountRow } from "@/components/cro/accounts-list";

function Tile({ value, unit, label, barPct }: { value: string; unit?: string; label: string; barPct?: number }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3.5">
      <p className="text-h3 font-bold tabular-nums text-white">
        {value}
        {unit && <span className="text-body-sm font-medium text-white/60"> {unit}</span>}
      </p>
      <p className="mt-0.5 text-caption text-white/70">{label}</p>
      {barPct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(barPct, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * Client-confirmed (2026-09-17) — the CRO Leader Dashboard opens as a
 * portfolio view rather than a bare account list: the same navy band used on
 * the Dashboard and GOS Dashboard (Design System §12), carrying counts across
 * every account the viewer can see. Numbers come from cro_account_portfolio()
 * (Backend Schema §7), so they respect the viewer's own RLS scope — a partner
 * sees totals for their granted accounts only.
 */
export function CroPortfolioSummary({
  accounts,
  title,
  viewerName,
  quarter,
}: {
  accounts: CroAccountRow[];
  title: string;
  viewerName: string;
  quarter: QuarterInfo;
}) {
  const total = accounts.length;
  const questionnaires = accounts.filter((a) => a.questionnaireComplete).length;
  const visionBoards = accounts.filter((a) => a.visionBoardComplete).length;
  const committed = accounts.reduce((sum, a) => sum + a.committedHours, 0);
  const achieved = accounts.reduce((sum, a) => sum + a.achievedHours, 0);
  const idle = accounts.filter((a) => a.idle).length;
  const pct = quarterPct({ committed, achieved });
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <HeroBand>
      <div>
        <h1 className="text-h1 text-white">{title}</h1>
        <p className="mt-0.5 text-body text-white/70">
          {total} {total === 1 ? "account" : "accounts"} · signed in as {viewerName}
        </p>
      </div>
      <div>
        <HeroLabel>
          Portfolio · {quarter.label}
        </HeroLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={String(total)} label={total === 1 ? "MSP account" : "MSP accounts"} />
          <Tile
            value={String(questionnaires)}
            unit={`of ${total}`}
            label="GrowthOS Solution Questionnaires complete"
            barPct={share(questionnaires)}
          />
          <Tile
            value={String(visionBoards)}
            unit={`of ${total}`}
            label="GrowthOS Vision Boards complete"
            barPct={share(visionBoards)}
          />
          <Tile
            value={formatHours(achieved)}
            unit={`of ${formatHours(committed)} hrs`}
            label={committed > 0 ? `Hours this quarter · ${pct}% of committed` : "Hours this quarter"}
            barPct={committed > 0 ? pct : 0}
          />
        </div>
        {idle > 0 && (
          <p className="mt-2.5 text-caption text-white/60">
            {idle} {idle === 1 ? "account has" : "accounts have"} had no activity in over 14 days.
          </p>
        )}
      </div>
    </HeroBand>
  );
}
