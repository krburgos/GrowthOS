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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chunk, resolveContactIds, type ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";

export function AssignOwnerDialog({
  open,
  onOpenChange,
  owners,
  selection,
  scope,
  selectedCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owners: { id: string; label: string }[];
  selection: { selectAllMatching: boolean; selectedIds: string[] };
  scope: ContactSelectionScope;
  selectedCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState<string>("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (!ownerId) {
      toast.error("Choose an owner.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const ids = await resolveContactIds(supabase, selection, scope);

    for (const batch of chunk(ids, 500)) {
      const { error } = await supabase.from("contacts").update({ owner_id: ownerId }).in("id", batch);
      if (error) {
        setPending(false);
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
    }

    setPending(false);
    toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} reassigned.`);
    onOpenChange(false);
    onDone();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {selectedCount} contact{selectedCount === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an owner…" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !ownerId}>
            {pending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
