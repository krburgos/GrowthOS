export interface WeeklyCount {
  label: string;
  count: number;
}

const VIEW_W = 420;
const VIEW_H = 130;
const PAD_X = 30;
const TOP_Y = 10;
const BASE_Y = 110;

/** App Flow §4.8 — leads/contacts added, per week. A hand-drawn single-hue line+area (dataviz: one axis, one series, no library needed for something this small). */
export function LeadsChart({ weeks, total }: { weeks: WeeklyCount[]; total: number }) {
  if (weeks.length === 0 || total === 0) {
    return <p className="px-4 py-6 text-body-sm text-neutral-500">No leads added in this period yet.</p>;
  }

  const max = Math.max(1, ...weeks.map((w) => w.count));
  const step = weeks.length > 1 ? (VIEW_W - PAD_X * 2) / (weeks.length - 1) : 0;
  const points = weeks.map((w, i) => {
    const x = PAD_X + i * step;
    const y = BASE_Y - (w.count / max) * (BASE_Y - TOP_Y);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${BASE_Y} L${points[0].x.toFixed(1)},${BASE_Y} Z`;
  const last = points[points.length - 1];

  return (
    <div className="flex items-end gap-4 p-4">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-20 flex-1" role="img" aria-label="Leads added per week">
        <path d={areaPath} fill="var(--color-secondary-100)" />
        <path d={linePath} fill="none" stroke="var(--color-secondary-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r={4} fill="var(--color-secondary-600)" />
      </svg>
      <div className="shrink-0 text-right">
        <p className="text-h3 font-bold tabular-nums text-primary-900">{total}</p>
        <p className="text-caption text-neutral-500">this period</p>
      </div>
    </div>
  );
}
