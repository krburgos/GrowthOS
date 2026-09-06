"use client";

import { Trash2 } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

/**
 * Client asked for a "Delete" action on lists. Implemented as the same
 * soft-delete every other entity in GrowthOS uses (archived_at, no real
 * DELETE) — lists are not the one exception (Opportunities) to that
 * rule, so "Delete" here means retire, not a permanent SQL delete.
 */
export function DeleteListButton({
  listId,
  listName,
  redirectTo,
}: {
  listId: string;
  listName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("lists")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", listId);
    setPending(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${listName} deleted.`);
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="mr-1.5 size-4" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete list</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">
            {listName} will no longer appear in Lists. Its contacts are not affected.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
