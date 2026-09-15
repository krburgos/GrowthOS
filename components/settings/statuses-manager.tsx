"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, GripVertical, MoreVertical, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export interface StatusRow {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

/**
 * App Flow §4.9, I3 — Custom Statuses. Add, rename, reorder, retire
 * (archive, per the soft-delete rule; no status is ever hard-deleted).
 * Reorder is drag-and-drop (client-confirmed 2026-09-15, @dnd-kit/sortable
 * — already pinned in the Tech Stack Lockfile for exactly this, just not
 * used yet — superseding the original up/down-arrow-only spec).
 */
export function StatusesManager({
  statuses,
  canEdit,
  accountId,
}: {
  statuses: StatusRow[];
  canEdit: boolean;
  accountId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<StatusRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [retireTarget, setRetireTarget] = useState<StatusRow | null>(null);

  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((s) => s.id === active.id);
    const newIndex = sorted.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setPendingId(String(active.id));
    const supabase = createClient();
    const results = await Promise.all(
      reordered
        .map((status, index) => ({ status, index }))
        .filter(({ status, index }) => status.sort_order !== index)
        .map(({ status, index }) => supabase.from("contact_statuses").update({ sort_order: index }).eq("id", status.id))
    );
    setPendingId(null);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      return;
    }
    router.refresh();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setPendingId("new");
    const supabase = createClient();
    const nextSortOrder = sorted.length > 0 ? Math.max(...sorted.map((s) => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from("contact_statuses").insert({
      account_id: accountId,
      name: newName.trim(),
      sort_order: nextSortOrder,
    });
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Status added.");
    setNewName("");
    setAddOpen(false);
    router.refresh();
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setPendingId(renameTarget.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("contact_statuses")
      .update({ name: renameValue.trim() })
      .eq("id", renameTarget.id);
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Status renamed.");
    setRenameTarget(null);
    router.refresh();
  };

  const handleRetire = async () => {
    if (!retireTarget) return;
    setPendingId(retireTarget.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("contact_statuses")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", retireTarget.id);
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${retireTarget.name} retired.`);
    setRetireTarget(null);
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {canEdit && (
        <Button size="sm" className="self-start" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Status
        </Button>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {sorted.map((status) => (
              <SortableStatusRow
                key={status.id}
                status={status}
                canEdit={canEdit}
                pending={pendingId === status.id}
                onRename={() => {
                  setRenameTarget(status);
                  setRenameValue(status.name);
                }}
                onRetire={() => setRetireTarget(status)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a status</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="new-status-name" required>
              Name
            </Label>
            <Input id="new-status-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={pendingId === "new"}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename status</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rename-status-name" required>
              Name
            </Label>
            <Input
              id="rename-status-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={pendingId === renameTarget?.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!retireTarget} onOpenChange={(o) => !o && setRetireTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire status</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">
            {retireTarget?.name} will no longer be available to assign to contacts. Existing
            contacts keep this status until changed.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetireTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRetire}
              disabled={pendingId === retireTarget?.id}
            >
              Retire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableStatusRow({
  status,
  canEdit,
  pending,
  onRename,
  onRetire,
}: {
  status: StatusRow;
  canEdit: boolean;
  pending: boolean;
  onRename: () => void;
  onRetire: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={"flex items-center justify-between gap-3 px-4 py-2.5 bg-white" + (isDragging ? " relative z-10 shadow-md" : "")}
    >
      <div className="flex items-center gap-3">
        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={pending}
            className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing disabled:opacity-30"
            aria-label={`Drag to reorder ${status.name}`}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <span className="text-body text-neutral-800">
          {status.name}
          {status.is_default && <span className="ml-2 text-caption text-neutral-400">Default</span>}
        </span>
      </div>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
              aria-label={`More actions for ${status.name}`}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="mr-2 size-4 text-neutral-400" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="text-error-700 data-[highlighted]:bg-error-50" onSelect={onRetire}>
              <Archive className="mr-2 size-4" />
              Retire
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
