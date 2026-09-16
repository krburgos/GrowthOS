"use client";

import { AlertCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { SuggestionItem } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PRIORITY_CLASSES: Record<"high" | "medium" | "low", string> = {
  high: "bg-error-100 text-error-700",
  medium: "bg-warning-100 text-warning-700",
  low: "bg-neutral-100 text-neutral-500",
};

const PRIORITY_OPTIONS: SuggestionItem["priority"][] = ["high", "medium", "low"];

interface SuggestionRow extends SuggestionItem {
  id: string;
}

/**
 * CRO Leader (cro_admin/cro_advisor) edit surface for a step's Suggestions
 * & Fixes list (Task 6). Immediate-persist pattern (same as EditKpiList) —
 * no separate Save button, each add/remove writes straight to
 * gos_dashboard_suggestions. Removal is a soft-delete (archived_at),
 * matching the project-wide no-hard-delete rule. Read-only viewers get the
 * plain list (Task 4's rendering) instead.
 */
export function EditSuggestionsList({
  accountId,
  stepSlug,
  initialSuggestions,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialSuggestions: SuggestionRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<SuggestionRow[]>(initialSuggestions);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<SuggestionItem["priority"]>("medium");
  const [detail, setDetail] = useState("");

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-2.5">
        {rows.length > 0 ? (
          rows.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-body-sm font-semibold text-neutral-800">{s.title}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold capitalize", PRIORITY_CLASSES[s.priority])}>
                    {s.priority}
                  </span>
                </div>
                <p className="text-caption text-neutral-500">{s.detail}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
        )}
      </div>
    );
  }

  const add = async () => {
    if (!title.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_suggestions")
      .insert({ account_id: accountId, step_slug: stepSlug, title, priority, detail: detail || null })
      .select("id, title, priority, detail")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => [
      ...prev,
      { id: data.id, title: data.title, priority: data.priority as SuggestionItem["priority"], detail: data.detail ?? "" },
    ]);
    setTitle("");
    setPriority("medium");
    setDetail("");
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_suggestions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-2.5">
      {rows.length > 0 ? (
        rows.map((s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-body-sm font-semibold text-neutral-800">{s.title}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold capitalize", PRIORITY_CLASSES[s.priority])}>
                  {s.priority}
                </span>
              </div>
              <p className="text-caption text-neutral-500">{s.detail}</p>
            </div>
            <button type="button" aria-label="Remove" onClick={() => remove(s.id)} className="text-neutral-400 hover:text-error-700">
              <X className="size-3.5" />
            </button>
          </div>
        ))
      ) : (
        <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-48" />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as SuggestionItem["priority"])}
          className="h-9 rounded-md border border-neutral-300 px-2 text-body-sm capitalize"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
        <Input placeholder="Detail" value={detail} onChange={(e) => setDetail(e.target.value)} className="w-56" />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Add Suggestion
        </Button>
      </div>
    </div>
  );
}
