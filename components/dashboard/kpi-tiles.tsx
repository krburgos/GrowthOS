import { cn } from "@/lib/utils";

export interface KpiTileData {
  label: string;
  value: string;
  delta?: { direction: "up" | "down" | "flat"; text: string };
}

const DELTA_CLASSES: Record<"up" | "down" | "flat", string> = {
  up: "bg-success-100 text-success-700",
  down: "bg-error-100 text-error-700",
  flat: "bg-neutral-100 text-neutral-500",
};

const HERO_DELTA_CLASSES: Record<"up" | "down" | "flat", string> = {
  up: "bg-success-500/25 text-success-100",
  down: "bg-error-500/25 text-error-100",
  flat: "bg-white/15 text-white/70",
};

/**
 * App Flow §4.3 — "weekly/monthly KPI snapshot: leads, opportunities created,
 * meetings, campaign sends." The "hero" variant (client-confirmed 2026-09-17,
 * "Concept B") renders the same tiles translucently for use inside HeroBand.
 */
export function KpiTiles({ tiles, variant = "card" }: { tiles: KpiTileData[]; variant?: "card" | "hero" }) {
  const hero = variant === "hero";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            "rounded-lg border p-3.5",
            hero ? "border-white/15 bg-white/10" : "border-neutral-200 bg-white"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-h3 font-bold tabular-nums", hero ? "text-white" : "text-primary-900")}>{tile.value}</p>
            {tile.delta && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold",
                  (hero ? HERO_DELTA_CLASSES : DELTA_CLASSES)[tile.delta.direction]
                )}
              >
                {tile.delta.text}
              </span>
            )}
          </div>
          <p className={cn("mt-1 text-caption", hero ? "text-white/70" : "text-neutral-500")}>{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
