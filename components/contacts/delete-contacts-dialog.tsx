"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { chunk, resolveContactIds, type ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";

/**
 * "Delete" is a soft-delete (archived_at) — contacts are never hard-
 * deleted (the app's non-negotiable soft-delete rule; Opportunities is
 * the one exception, contacts aren't). Confirmation dialog per the
 * client's own request for a delete prompt.
 */
export function DeleteContactsDialog({
  open,
  onOpenChange,
  selection,
  scope,
  selectedCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: { selectAllMatching: boolean; selectedIds: string[] };
  scope: ContactSelectionScope;
  selectedCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    const supabase = createClient();
    const ids = await resolveContactIds(supabase, selection, scope);

    for (const batch of chunk(ids, 500)) {
      const { error } = await supabase
        .from("contacts")
        .update({ archived_at: new Date().toISOString() })
        .in("id", batch);
      if (error) {
        setPending(false);
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
    }

    setPending(false);
    toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} deleted.`);
    onOpenChange(false);
    onDone();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {selectedCount} contact{selectedCount === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <p className="text-body text-neutral-600">
          These contacts will no longer appear anywhere in GrowthOS. This can be undone by GrowthOS
          support if needed, but there's no undo in the app itself.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
