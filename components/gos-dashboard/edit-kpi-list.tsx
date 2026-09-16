"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { KpiStat } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { KpiGrid } from "@/components/gos-dashboard/kpi-grid";

interface KpiRow extends KpiStat {
  id: string;
}

/**
 * CRO Leader (cro_admin/cro_advisor) edit surface for a step's KPI list
 * (Task 5). Immediate-persist pattern (same as components/settings/
 * statuses-manager.tsx) — no separate Save button, each add/remove writes
 * straight to gos_dashboard_kpis. Removal is a soft-delete (archived_at),
 * matching the project-wide no-hard-delete rule. Read-only viewers get the
 * plain KpiGrid instead.
 */
export function EditKpiList({
  accountId,
  stepSlug,
  initialKpis,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialKpis: (KpiStat & { id: string })[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<KpiRow[]>(initialKpis);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");

  if (!canEdit) {
    return <KpiGrid kpis={rows} />;
  }

  const add = async () => {
    if (!label.trim() || !value.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_kpis")
      .insert({ account_id: accountId, step_slug: stepSlug, label, value, target: target || null })
      .select("id, label, value, target")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => [...prev, { id: data.id, label: data.label, value: data.value, target: data.target ?? undefined }]);
    setLabel("");
    setValue("");
    setTarget("");
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_kpis")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="relative rounded-lg border border-neutral-200 bg-white p-3.5">
              <button
                type="button"
                aria-label="Remove"
                onClick={() => remove(row.id)}
                className="absolute right-2 top-2 text-neutral-400 hover:text-error-700"
              >
                <X className="size-3.5" />
              </button>
              <p className="text-h4 font-bold tabular-nums text-primary-900">{row.value}</p>
              <p className="mt-0.5 text-caption text-neutral-500">{row.label}</p>
              {row.target && <p className="mt-1 text-caption font-medium text-secondary-700">Target: {row.target}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-40" />
        <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className="w-28" />
        <Input placeholder="Target (optional)" value={target} onChange={(e) => setTarget(e.target.value)} className="w-40" />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Add KPI
        </Button>
      </div>
    </div>
  );
}
