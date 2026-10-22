"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { HoursBar, OutsourcedChip } from "@/components/growth-mission/hours-ui";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { formatWhole, type QuarterInfo, type StepHours } from "@/lib/growth-mission/hours";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * The discipline page's hours (client-confirmed, 2026-10-13): Required,
 * Committed and Completed for this discipline this quarter, the same three
 * figures as its Mission Card, all derived. The Log hours dialog is gone
 * because nothing here is typed any more.
 *
 * That dialog was also the only place the Outsourced flag could be set, so
 * the chip in the header becomes a Yes/No toggle for the people who could
 * set it before (MSP Owner/Admin and CRO Leader). Everyone else still sees
 * the read-only chip.
 */
export function StepHoursPanel({
  accountId,
  slug,
  hours,
  quarter,
  canEditOutsourced,
  reportSlot,
  focusSlot,
}: {
  accountId: string;
  slug: string;
  hours: StepHours;
  quarter: QuarterInfo;
  canEditOutsourced: boolean;
  /**
   * The discipline's report, rendered on this panel's header line
   * (client-confirmed, 2026-10-02). Passed in as a slot rather than
   * imported here so this panel stays a presentation component, the same
   * way StepHeader takes its overview slot.
   */
  reportSlot?: ReactNode;
  /** The Mission Card's Focus button (2026-10-22). */
  focusSlot?: ReactNode;
}) {
  const router = useRouter();
  const [outsourced, setOutsourced] = useState(hours.outsourced);
  const [saving, setSaving] = useState(false);
  const pct = hours.required > 0 ? Math.round((hours.completed / hours.required) * 100) : 0;

  const saveOutsourced = async (value: boolean) => {
    if (value === outsourced) return;
    setOutsourced(value);
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("growth_mission_step_hours")
      .upsert(
        { account_id: accountId, step_slug: slug, outsourced: value, updated_by: user?.id ?? null },
        { onConflict: "account_id,step_slug" }
      );
    setSaving(false);
    if (error) {
      setOutsourced(!value);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  const stats = [
    { label: "Required this quarter", value: hours.required },
    { label: "Committed this quarter", value: hours.committed },
    { label: "Completed this quarter", value: hours.completed },
    { label: "Still to go", value: Math.max(0, hours.required - hours.completed) },
  ];

  return (
    // Client-confirmed (2026-10-14, "Discipline Header Blue" A): a navy title
    // bar and the figures on light blue, matching the Mission Orders table.
    <section className="overflow-hidden rounded-lg border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${NAVY_GRADIENT}`}>
        <h2 className="shrink-0 text-h4 text-white">
          Hours <span className="font-normal text-secondary-300">· {quarter.label}</span>
        </h2>
        {/* The report sits between the title and the actions, so one line
            carries everything about this discipline that is not a number. */}
        {reportSlot}
        <div className="ml-auto flex items-center gap-3">
          {focusSlot}
          {canEditOutsourced ? (
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium text-white/80">Outsourced</span>
              <div className="inline-flex overflow-hidden rounded-md border border-white/30" role="group" aria-label="Outsourced">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={outsourced === v}
                    disabled={saving}
                    onClick={() => saveOutsourced(v)}
                    className={cn(
                      "px-3.5 py-1 text-body-sm font-semibold disabled:opacity-60",
                      !v && "border-l border-neutral-300",
                      outsourced === v
                        ? v
                          ? "bg-success-100 text-success-700"
                          : "bg-error-100 text-error-700"
                        : "bg-white text-neutral-600 hover:bg-neutral-50"
                    )}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <OutsourcedChip outsourced={hours.outsourced} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 bg-primary-50 sm:grid-cols-4 sm:divide-x sm:divide-primary-200">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="text-caption text-primary-700">{s.label}</span>
            <span className="text-h3 font-bold tabular-nums text-primary-900">
              {formatWhole(s.value)} <span className="text-body-sm font-medium text-neutral-400">hrs</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-primary-200 bg-primary-50 px-5 py-3.5">
        <div className="flex flex-wrap justify-between gap-1 text-caption text-primary-700">
          <span>
            <b className="font-semibold tabular-nums text-neutral-800">{pct}%</b> of this quarter&apos;s required hours
            completed
          </span>
          <span className="tabular-nums">{quarter.elapsedPct}% of the quarter elapsed</span>
        </div>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} className="bg-white" />
      </div>
    </section>
  );
}
