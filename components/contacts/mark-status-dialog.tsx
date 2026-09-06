"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

export function MarkStatusDialog({
  open,
  onOpenChange,
  statuses,
  selection,
  scope,
  selectedCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: { id: string; label: string }[];
  selection: { selectAllMatching: boolean; selectedIds: string[] };
  scope: ContactSelectionScope;
  selectedCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [statusId, setStatusId] = useState<string>("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (!statusId) {
      toast.error("Choose a status.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const ids = await resolveContactIds(supabase, selection, scope);

    for (const batch of chunk(ids, 500)) {
      const { error } = await supabase.from("contacts").update({ status_id: statusId }).in("id", batch);
      if (error) {
        setPending(false);
        toast.error(error.message);
        return;
      }
    }

    setPending(false);
    toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} updated.`);
    onOpenChange(false);
    onDone();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {selectedCount} contact{selectedCount === 1 ? "" : "s"} as…</DialogTitle>
        </DialogHeader>
        <Select value={statusId} onValueChange={setStatusId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a status…" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !statusId}>
            {pending ? "Updating…" : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
