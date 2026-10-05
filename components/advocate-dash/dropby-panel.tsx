import { SampleButtons } from "@/components/advocate-dash/sample-buttons";
import { targetSummary, type AdvocateTarget } from "@/lib/advocate-dash/targets";

/**
 * AdvocateDash's header panel, standing where the other fifteen
 * workstreams show Hours (client-confirmed, 2026-10-05).
 *
 * Two departures from that panel, both deliberate:
 *
 *   — It counts drop-bys, not hours. This workstream is measured in visits
 *     made, so there is no quarter commitment to measure progress against
 *     and no "Log hours" button. The four figures are derived from the
 *     table below rather than entered anywhere, which is why none of them
 *     is editable.
 *
 *   — The report slot holds two sample buttons instead of one report
 *     control. There is no single per-account report here; there is one per
 *     drop-by, in the table. What belongs up here is the pair of worked
 *     examples showing what the service produces.
 *
 * A server component: it renders counts and one client island
 * (SampleButtons), so there is nothing for it to hold state about.
 */
export function DropbyPanel({ targets }: { targets: AdvocateTarget[] }) {
  const summary = targetSummary(targets);

  const stats = [
    { label: "Targets on the list", value: summary.targets },
    { label: "Scheduled", value: summary.scheduled },
    { label: "Drop-bys done", value: summary.completed, highlight: true },
    { label: "Awaiting a report", value: summary.awaitingReport },
  ];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-5 py-3">
        <h2 className="shrink-0 text-h4 text-primary-900">
          Drop-bys <span className="font-normal text-neutral-400">· all time</span>
        </h2>
        <SampleButtons />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-neutral-100">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="text-caption text-neutral-500">{s.label}</span>
            <span
              className={`text-h3 font-bold tabular-nums ${
                s.highlight ? "text-secondary-700" : "text-primary-900"
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
