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

/** App Flow §4.3 — "weekly/monthly KPI snapshot: leads, opportunities created, meetings, campaign sends." */
export function KpiTiles({ tiles }: { tiles: KpiTileData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-h3 font-bold tabular-nums text-primary-900">{tile.value}</p>
            {tile.delta && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold",
                  DELTA_CLASSES[tile.delta.direction]
                )}
              >
                {tile.delta.text}
              </span>
            )}
          </div>
          <p className="mt-1 text-caption text-neutral-500">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
