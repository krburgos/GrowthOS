"use client";

import { CalendarRange, Check, FlaskConical, Minus, OctagonAlert, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { HoursBar } from "@/components/gos-dashboard/log-hours-dialog";
import { HoursCard } from "@/components/gos-dashboard/hours-card";
import { KpiBand } from "@/components/gos-dashboard/kpi-band";
import { useMockup } from "@/components/gos-dashboard/mockup-store";
import { quarterPct, paceTone } from "@/lib/gos-dashboard/hours-mockup";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";
import { cn } from "@/lib/utils";

function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-caption font-medium text-warning-800">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-warning-300 bg-white" role="group" aria-label={label}>
        {options.map((o, i) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "px-2.5 py-1 text-caption font-semibold",
              i > 0 && "border-l border-warning-300",
              value === o.value ? "bg-warning-100 text-warning-800" : "text-neutral-500 hover:bg-neutral-50"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check2({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-full",
          ok ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-800"
        )}
      >
        {ok ? <Check className="size-3" strokeWidth={2.5} /> : <Minus className="size-3" strokeWidth={2.5} />}
      </span>
      {children}
    </span>
  );
}

function Readiness({ website }: { website: string | null }) {
  const { icpWritten } = useMockup();
  const ready = !!website && icpWritten;

  if (ready) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-neutral-700">
          <ShieldCheck className="size-4 text-success-600" />
          Ready to run the Playbook
        </span>
        <Check2 ok>
          Website on file · <b className="font-semibold text-neutral-800">{website}</b>
        </Check2>
        <Check2 ok>
          ICP written · <b className="font-semibold text-neutral-800">Vision Board</b>
        </Check2>
        <span className="ml-auto text-caption text-neutral-400">From Company settings and the Vision Board</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-warning-800">
        <OctagonAlert className="size-4" />
        Before You Begin
      </span>
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <p className="max-w-[72ch] text-body-sm text-warning-800">
          Nothing in the Playbook will work until both foundations are in place: a functioning website and a written Ideal
          Client Profile.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Check2 ok={!!website}>
            {website ? (
              <>
                Website on file · <b className="font-semibold text-neutral-800">{website}</b>
              </>
            ) : (
              <>
                No website on file ·{" "}
                <Link href="/settings/company" className="font-semibold text-primary-700 hover:underline">
                  Add it in Company settings →
                </Link>
              </>
            )}
          </Check2>
          <Check2 ok={icpWritten}>
            {icpWritten ? (
              "ICP written · Vision Board"
            ) : (
              <>
                ICP not written yet ·{" "}
                <Link href="/settings/vision-board" className="font-semibold text-primary-700 hover:underline">
                  Complete the Vision Board →
                </Link>
              </>
            )}
          </Check2>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, unit }: { k: string; v: string; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3.5">
      <span className="text-caption font-medium text-neutral-500">{k}</span>
      <span className="text-h3 font-bold tabular-nums text-primary-900">
        {v} <span className="text-body-sm font-medium text-neutral-400">{unit}</span>
      </span>
    </div>
  );
}

function TotalsStrip() {
  const { hours, quarter } = useMockup();
  const all = Object.values(hours);
  const needed = all.reduce((s, h) => s + h.needed, 0);
  const committed = all.reduce((s, h) => s + h.committed, 0);
  const achieved = all.reduce((s, h) => s + h.achieved, 0);
  const outsourced = all.filter((h) => h.outsourced).length;
  const pct = quarterPct({ needed, committed, achieved, outsourced: false });
  const tone = paceTone(pct, quarter.elapsedPct);

  return (
    <div className="grid grid-cols-2 divide-neutral-100 rounded-lg border border-neutral-200 bg-white lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr] lg:divide-x">
      <Stat k="Hours needed (all workstreams)" v={needed.toLocaleString()} unit="hrs" />
      <Stat k="Committed this quarter" v={committed.toLocaleString()} unit="hrs" />
      <Stat k="Achieved this quarter" v={achieved.toLocaleString()} unit="hrs" />
      <Stat k="Outsourced" v={String(outsourced)} unit={`of ${all.length} workstreams`} />
      <div className="col-span-2 flex flex-col justify-center gap-2 border-t border-neutral-100 px-4 py-3.5 lg:col-span-1 lg:border-t-0">
        <div className="flex flex-wrap justify-between gap-1 text-caption text-neutral-500">
          <span>Quarter progress</span>
          <span>
            <b className={cn("font-semibold tabular-nums", tone === "behind" ? "text-warning-800" : "text-neutral-800")}>{pct}%</b> of
            committed · <span className="tabular-nums">{quarter.elapsedPct}%</span> of quarter elapsed
          </span>
        </div>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
      </div>
    </div>
  );
}

export function GosDashboardView({
  website,
  canLogHours,
  canEditMapping,
}: {
  website: string | null;
  canLogHours: boolean;
  canEditMapping: boolean;
}) {
  const { quarter, cardStyle, setCardStyle, icpWritten, setIcpWritten, reset } = useMockup();

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-dashed border-warning-300 bg-warning-50 px-3.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-caption font-bold uppercase tracking-wide text-warning-800">
          <FlaskConical className="size-3.5" />
          Mockup · sample data
        </span>
        <Segmented
          label="Card style"
          value={cardStyle}
          options={[
            { value: "stack", label: "A — Stat stack" },
            { value: "ledger", label: "B — Ledger" },
          ]}
          onChange={setCardStyle}
        />
        <Segmented
          label="ICP written"
          value={icpWritten}
          options={[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ]}
          onChange={setIcpWritten}
        />
        <button
          type="button"
          onClick={() => {
            reset();
            toast.success("Sample data restored.");
          }}
          className="ml-auto inline-flex items-center gap-1 text-caption font-semibold text-warning-800 hover:underline"
        >
          <RotateCcw className="size-3.5" />
          Reset sample data
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">GOS Dashboard</h1>
          <p className="max-w-[70ch] text-body text-neutral-500">
            The GrowthOS Playbook, tracked by hours — 4 phases, 14 workstreams from SEO through Sales Enablement. Click
            into any card for its status report, duties, and KPIs.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-3 py-1.5 text-body-sm font-semibold text-primary-700">
          <CalendarRange className="size-4" />
          {quarter.label} · {quarter.range}
        </span>
      </div>

      <Readiness website={website} />

      <KpiBand canEditMapping={canEditMapping} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-body-sm font-semibold text-neutral-600">Workstream hours</h2>
          <span className="text-caption text-neutral-400">
            {canLogHours ? "You can log hours on any card" : "View only — MSP Owner/Admin and CRO Admin/Advisor log hours"}
          </span>
        </div>
        <TotalsStrip />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLAYBOOK_STEPS.map((step) => (
          <HoursCard key={step.slug} step={step} canLogHours={canLogHours} />
        ))}
      </div>
    </main>
  );
}
