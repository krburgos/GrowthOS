export interface MonthlyRevenue {
  label: string;
  total: number;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** App Flow §4.8 — revenue from closed-won opportunities (opportunities.value, never self-reported per PRD §6.7). */
export function RevenueBars({ months, total, dealCount }: { months: MonthlyRevenue[]; total: number; dealCount: number }) {
  if (dealCount === 0) {
    return <p className="px-4 py-6 text-body-sm text-neutral-500">No opportunities won yet.</p>;
  }

  const max = Math.max(1, ...months.map((m) => m.total));

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="shrink-0">
        <p className="text-h3 font-bold tabular-nums text-primary-900">{currency.format(total)}</p>
        <p className="text-caption text-neutral-500">
          {dealCount} opportunit{dealCount === 1 ? "y" : "ies"} won
        </p>
      </div>
      <div className="flex h-20 flex-1 items-end gap-3 px-1">
        {months.map((m) => (
          <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span
              className="w-full max-w-11 rounded-t-sm bg-success-500"
              style={{ height: `${Math.max((m.total / max) * 100, m.total > 0 ? 4 : 0)}%` }}
            />
            <span className="text-caption text-neutral-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
