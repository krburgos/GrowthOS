"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
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
 * App Flow §4.9, I3 — Custom Statuses. Add, rename, reorder (up/down —
 * not spec'd as drag-and-drop), retire (archive, per the soft-delete
 * rule; no status is ever hard-deleted).
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

  const move = async (index: number, direction: -1 | 1) => {
    const other = sorted[index + direction];
    const current = sorted[index];
    if (!other) return;

    setPendingId(current.id);
    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("contact_statuses").update({ sort_order: other.sort_order }).eq("id", current.id),
      supabase.from("contact_statuses").update({ sort_order: current.sort_order }).eq("id", other.id),
    ]);
    setPendingId(null);

    if (e1 || e2) {
      toast.error(e1?.message ?? e2?.message ?? "Couldn't reorder.");
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
    <div className="flex max-w-xl flex-col gap-4">
      {canEdit && (
        <Button size="sm" className="self-start" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Status
        </Button>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
        {sorted.map((status, index) => (
          <li key={status.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-body text-neutral-800">
              {status.name}
              {status.is_default && (
                <span className="ml-2 text-caption text-neutral-400">Default</span>
              )}
            </span>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0 || pendingId === status.id}
                  onClick={() => move(index, -1)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  aria-label={`Move ${status.name} up`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={index === sorted.length - 1 || pendingId === status.id}
                  onClick={() => move(index, 1)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  aria-label={`Move ${status.name} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRenameTarget(status);
                    setRenameValue(status.name);
                  }}
                >
                  Rename
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRetireTarget(status)}>
                  Retire
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

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
