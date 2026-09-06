"use client";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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

/**
 * Design System §8.9-style overflow menu (Concept B, approved for
 * Contact Statuses/Opportunity Stages) reused here for List row/header
 * actions — replaces the standalone red "Delete" text button
 * (`DeleteListButton`) and adds Rename, which didn't exist anywhere
 * before (a list's name could only be set once, at creation).
 *
 * "Delete" keeps that exact label, not "Retire": the client
 * specifically asked for a "Delete" action on lists, even though the
 * underlying operation is the same soft-delete (`archived_at`) every
 * other entity in GrowthOS uses — no real SQL DELETE.
 */
export function ListActionsMenu({
  listId,
  listName,
  redirectOnDelete,
}: {
  listId: string;
  listName: string;
  redirectOnDelete?: string;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(listName);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("lists").update({ name: renameValue.trim() }).eq("id", listId);
    setPending(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("List renamed.");
    setRenameOpen(false);
    router.refresh();
  };

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
    setDeleteOpen(false);
    if (redirectOnDelete) router.push(redirectOnDelete);
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
            aria-label={`More actions for ${listName}`}
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setRenameValue(listName);
              setRenameOpen(true);
            }}
          >
            <Pencil className="mr-2 size-4 text-neutral-400" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-error-700 data-[highlighted]:bg-error-50"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rename-list-name" required>
              Name
            </Label>
            <Input
              id="rename-list-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={pending || !renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete list</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">
            {listName} will no longer appear in Lists. Its contacts are not affected.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
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
