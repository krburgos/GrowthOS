"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { DELIVERABLE_PRESETS, NAME_MAX, PRESETS_MAX } from "@/lib/programs/deliverables";
import { createClient } from "@/lib/supabase/client";

interface Entry {
  id: string;
  name: string;
}

const toEntries = (names: string[]): Entry[] => names.map((name) => ({ id: crypto.randomUUID(), name }));

/**
 * "Edit presets" for one client's Next Deliverables chips (client-confirmed
 * 2026-11-19, approved mockup "Deliverable Presets Mockup"). CRO Admin and
 * CRO Advisor rename, reorder, remove and add presets; Save writes the whole
 * list to program_deliverable_presets. Deliverables already added are never
 * touched.
 */
export function DeliverablePresetsDialog({
  open,
  onOpenChange,
  accountId,
  clientName,
  presets,
  currentUserId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  clientName: string;
  presets: string[];
  currentUserId: string;
  onSaved: (names: string[]) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => toEntries(presets));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Start from the saved list every time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEntries(toEntries(presets));
      setDraft("");
      setError("");
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setEntries((xs) => arrayMove(xs, xs.findIndex((x) => x.id === active.id), xs.findIndex((x) => x.id === over.id)));
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (entries.some((x) => x.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`“${name}” is already a preset.`);
      return;
    }
    if (entries.length >= PRESETS_MAX) {
      setError(`A client can have up to ${PRESETS_MAX} presets.`);
      return;
    }
    setEntries((xs) => [...xs, { id: crypto.randomUUID(), name }]);
    setDraft("");
    setError("");
  }

  async function save() {
    const names = entries.map((x) => x.name.trim()).filter(Boolean);
    const seen = new Set<string>();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k)) {
        setError(`“${n}” is listed twice.`);
        return;
      }
      seen.add(k);
    }
    setSaving(true);
    const { error: saveError } = await createClient()
      .from("program_deliverable_presets")
      .upsert({ account_id: accountId, program: "tactical_leads", names, updated_by: currentUserId }, { onConflict: "account_id,program" });
    setSaving(false);
    if (saveError) {
      toast.error(getFriendlyErrorMessage(saveError));
      return;
    }
    onSaved(names);
    onOpenChange(false);
    toast.success(`Presets saved for ${clientName}.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-48px)] w-[calc(100%-32px)] flex-col">
        <DialogHeader className="pr-6">
          <DialogTitle>Deliverable presets</DialogTitle>
          <DialogDescription>The quick-add chips for {clientName}. Other clients keep their own list.</DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="rounded-md border border-neutral-200 px-3 py-3.5 text-center text-body-sm text-neutral-500">
            No presets. Only “Add your own” will show.
          </p>
        ) : (
          <DndContext id="deliverable-presets" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={entries.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex min-h-0 flex-col divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
                {entries.map((x) => (
                  <PresetRow
                    key={x.id}
                    entry={x}
                    onRename={(name) => setEntries((xs) => xs.map((y) => (y.id === x.id ? { ...y, name } : y)))}
                    onRemove={() => setEntries((xs) => xs.filter((y) => y.id !== x.id))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <form onSubmit={add} className="mt-3 flex gap-2">
          <Input
            value={draft}
            maxLength={NAME_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New preset, e.g. Call script"
            aria-label="New preset"
            className="min-w-0 flex-1 text-body-sm"
          />
          <Button type="submit" variant="secondary">
            <Plus className="size-4" />
            Add
          </Button>
        </form>
        {error && <p className="mt-1.5 text-caption text-error-700">{error}</p>}

        <DialogFooter className="flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEntries(toEntries(DELIVERABLE_PRESETS));
              setError("");
            }}
            className="mr-auto rounded-sm text-body-sm font-semibold text-neutral-500 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            Reset to defaults
          </button>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save presets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresetRow({ entry, onRename, onRemove }: { entry: Entry; onRename: (name: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const what = entry.name.trim() || "preset";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={"flex items-center gap-2 bg-white py-1.5 pl-1.5 pr-2" + (isDragging ? " relative z-10 shadow-md" : "")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        aria-label={`Drag to reorder ${what}`}
      >
        <GripVertical className="size-4" />
      </button>
      <input
        value={entry.name}
        maxLength={NAME_MAX}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Preset name"
        className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-body-sm text-neutral-800 hover:border-neutral-200 focus-visible:border-secondary-500 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${what}`}
        title="Remove"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
