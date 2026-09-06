"use client";

import { useEffect, useState } from "react";
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
import { resolveContactIds, type ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";

type Action = "move" | "copy";

/**
 * Client-defined semantics: Move removes the selected contacts from
 * the current list and adds them to the destination; Copy adds them to
 * the destination while leaving the current list's membership
 * untouched (a contact can belong to multiple lists). Only shown
 * inside a specific list's detail page — on the All Contacts view
 * there's no single "current list" to move out of (client-confirmed
 * "Add-only" there instead).
 */
export function MoveOrCopyDialog({
  open,
  onOpenChange,
  currentListId,
  accountId,
  selection,
  selectedCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentListId: string;
  accountId: string;
  selection: { selectAllMatching: boolean; selectedIds: string[] };
  selectedCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action>("move");
  const [destinationListId, setDestinationListId] = useState<string>("");
  const [otherLists, setOtherLists] = useState<{ id: string; name: string }[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("lists")
      .select("id, name")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .neq("id", currentListId)
      .order("name")
      .then(({ data }) => setOtherLists(data ?? []));
  }, [open, accountId, currentListId]);

  const handleSubmit = async () => {
    if (!destinationListId) {
      toast.error("Choose a destination list.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const scope: ContactSelectionScope = { mode: "list", listId: currentListId };
    const selectedContactIds = await resolveContactIds(supabase, selection, scope);

    const { error: insertError } = await supabase.from("list_members").upsert(
      selectedContactIds.map((contactId) => ({
        list_id: destinationListId,
        contact_id: contactId,
        added_by: user!.id,
      })),
      { onConflict: "list_id,contact_id", ignoreDuplicates: true }
    );
    if (insertError) {
      setPending(false);
      toast.error(insertError.message);
      return;
    }

    if (action === "move") {
      const { error: deleteError } = await supabase
        .from("list_members")
        .delete()
        .eq("list_id", currentListId)
        .in("contact_id", selectedContactIds);
      if (deleteError) {
        setPending(false);
        toast.error(deleteError.message);
        return;
      }
    }

    setPending(false);
    toast.success(
      `${selectedContactIds.length} contact${selectedContactIds.length === 1 ? "" : "s"} ${
        action === "move" ? "moved" : "copied"
      }.`
    );
    setDestinationListId("");
    onOpenChange(false);
    onDone();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "move" ? "Move" : "Copy"} {selectedCount} contact
            {selectedCount === 1 ? "" : "s"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={action === "move" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAction("move")}
          >
            Move
          </Button>
          <Button
            type="button"
            variant={action === "copy" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAction("copy")}
          >
            Copy
          </Button>
        </div>
        <p className="text-body-sm text-neutral-500">
          {action === "move"
            ? "Removes these contacts from the current list and adds them to the one you choose."
            : "Adds these contacts to the list you choose — they stay in the current list too."}
        </p>

        <Select value={destinationListId} onValueChange={setDestinationListId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a list…" />
          </SelectTrigger>
          <SelectContent>
            {otherLists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !destinationListId}>
            {pending ? "Working…" : action === "move" ? "Move" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
