"use client";

import { Check, Lock, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

/**
 * One field that edits in place (client-confirmed, 2026-09-22, approved
 * mockup "B" for My Profile): click the value, change it, press Enter.
 *
 * This replaces the Update Info / Save / Cancel round trip for the common
 * case of correcting a single field. Escape cancels, Enter or blur saves,
 * and nothing is written when the value has not actually changed - so
 * clicking into a field and clicking away again is not a write.
 *
 * Saving is delegated: the caller supplies onSave so this component knows
 * nothing about tables or columns, which is what lets My Profile and any
 * later screen share it.
 */
export function InlineField({
  label,
  value,
  placeholder = "Not set",
  type = "text",
  readOnly = false,
  readOnlyNote,
  href,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "tel" | "url";
  /** Read-only fields render a lock rather than becoming editable. */
  readOnly?: boolean;
  readOnlyNote?: string;
  /** When set and not editing, the value renders as a link. */
  href?: string;
  onSave?: (next: string) => Promise<{ error: unknown } | void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A save elsewhere (or a router.refresh) should win over a stale draft.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!onSave || next === value.trim()) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setSaving(true);
    const result = await onSave(next);
    setSaving(false);
    if (result && "error" in result && result.error) {
      toast.error(getFriendlyErrorMessage(result.error));
      return;
    }
    toast.success(`${label} updated.`);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-1 py-2.5">
      <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">{label}</span>

      {readOnly ? (
        <p className="flex min-h-8 items-center gap-2 text-body text-neutral-800">
          {value || <span className="text-neutral-300">{placeholder}</span>}
          <span
            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
            title={readOnlyNote}
          >
            <Lock className="size-2.5" />
            Read only
          </span>
        </p>
      ) : editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={type}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            // Blur saves, but not when the pointer landed on this field's own
            // cancel button - otherwise cancelling would save first.
            onBlur={(e) => {
              if (e.relatedTarget?.getAttribute("data-inline-cancel") === "true") return;
              void commit();
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-secondary-400 bg-white px-2.5 text-body text-neutral-800 outline-none ring-2 ring-secondary-500/25"
          />
          {saving ? (
            <Spinner className="size-4" />
          ) : (
            <>
              <button
                type="button"
                aria-label={`Save ${label}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commit()}
                className="flex size-7 items-center justify-center rounded-md text-success-700 hover:bg-success-100"
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                data-inline-cancel="true"
                aria-label={`Cancel editing ${label}`}
                onClick={cancel}
                className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex min-h-8 w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        >
          {value ? (
            href ? (
              <span className="min-w-0 truncate text-body font-medium text-primary-700">{value}</span>
            ) : (
              <span className="min-w-0 truncate text-body text-neutral-800">{value}</span>
            )
          ) : (
            <span className="text-body text-neutral-300">{placeholder}</span>
          )}
          <Pencil className="size-3.5 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      )}
    </div>
  );
}
