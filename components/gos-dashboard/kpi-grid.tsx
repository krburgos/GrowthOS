import type { KpiStat } from "@/lib/gos-dashboard/playbook";

export function KpiGrid({ kpis }: { kpis: KpiStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-primary-900">{kpi.value}</p>
          <p className="mt-0.5 text-caption text-neutral-500">{kpi.label}</p>
          {kpi.target && <p className="mt-1 text-caption font-medium text-secondary-700">Target: {kpi.target}</p>}
        </div>
      ))}
    </div>
  );
}
