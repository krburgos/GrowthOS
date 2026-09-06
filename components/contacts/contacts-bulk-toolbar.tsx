"use client";

import { ChevronDown, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { AssignOwnerDialog } from "@/components/contacts/assign-owner-dialog";
import { DeleteContactsDialog } from "@/components/contacts/delete-contacts-dialog";
import { ExportContactsButton } from "@/components/contacts/export-contacts-button";
import { MarkStatusDialog } from "@/components/contacts/mark-status-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import { MoveOrCopyDialog } from "@/components/lists/move-or-copy-dialog";
import { resolveContactIds, type ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";

export interface ContactSelectionState {
  selectedIds: Set<string>;
  selectAllMatching: boolean;
}

/**
 * Client-confirmed bulk action bar, modeled on a reference CRM's
 * layout: Email/Export/Delete + a More Actions dropdown (Assign, Mark
 * as, Add to, and — only inside a specific list's detail page — Move
 * to). Merge was dropped per client direction (duplicate emails are
 * handled by updating the existing contact during import/add, not a
 * separate merge step). Email is a stub — real sending needs Campaigns
 * (Milestone 10), not built yet.
 *
 * Impeccable critique finding (2026-09-06, P2): these buttons had
 * drifted onto hand-rolled `rounded-full` pills and a literal "▾"
 * glyph instead of the shared Button component's radius-md (§8.1) and
 * a lucide icon (§8.13) — fixed to match, on the control cluster most
 * likely to appear in a client demo.
 */
export function ContactsBulkToolbar({
  selection,
  scope,
  accountId,
  totalCount,
  statuses,
  owners,
  currentListId,
  onClear,
  onSelectAllMatching,
  onActionComplete,
}: {
  selection: ContactSelectionState;
  scope: ContactSelectionScope;
  accountId: string;
  totalCount: number;
  statuses: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  currentListId?: string;
  onClear: () => void;
  onSelectAllMatching: () => void;
  onActionComplete: () => void;
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [markStatusOpen, setMarkStatusOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const selectedCount = selection.selectAllMatching ? totalCount : selection.selectedIds.size;
  const selectionArg = { selectAllMatching: selection.selectAllMatching, selectedIds: [...selection.selectedIds] };

  const handleRemoveFromList = async () => {
    if (!currentListId) return;
    setRemoving(true);
    const supabase = createClient();
    const ids = await resolveContactIds(supabase, selectionArg, scope);

    const { error } = await supabase.from("list_members").delete().eq("list_id", currentListId).in("contact_id", ids);
    setRemoving(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} removed from list.`);
    onActionComplete();
    router.refresh();
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-gradient-to-b from-primary-800 to-primary-900 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => toast("Email requires Campaigns (Milestone 10), not set up yet.")}
          aria-label="Email selected contacts"
          className="gap-2 text-white hover:bg-white/20 hover:text-white active:bg-white/30"
        >
          <Mail className="size-4" />
          Email
        </Button>
        <ExportContactsButton selection={selectionArg} scope={scope} />
        <Button
          type="button"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete selected contacts"
          className="gap-2"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" className="gap-1">
              More Actions
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setAssignOpen(true)}>Assign</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMarkStatusOpen(true)}>Mark as</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAddToListOpen(true)}>Add to</DropdownMenuItem>
            {currentListId && (
              <>
                <DropdownMenuItem onSelect={() => setMoveOpen(true)}>Move to</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleRemoveFromList} disabled={removing}>
                  Remove from this list
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-body-sm font-medium text-white/90">
          {selectedCount} item{selectedCount === 1 ? "" : "s"} selected.
        </span>
        <div className="flex items-center gap-4">
          {!selection.selectAllMatching && totalCount > selection.selectedIds.size && (
            <button type="button" onClick={onSelectAllMatching} className="text-body-sm font-medium text-secondary-400 hover:underline">
              Select all {totalCount} items
            </button>
          )}
          <button type="button" onClick={onClear} className="text-body-sm font-medium text-white/60 hover:text-white hover:underline">
            Clear selection
          </button>
        </div>
      </div>

      <AssignOwnerDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        owners={owners}
        selection={selectionArg}
        scope={scope}
        selectedCount={selectedCount}
        onDone={onActionComplete}
      />
      <MarkStatusDialog
        open={markStatusOpen}
        onOpenChange={setMarkStatusOpen}
        statuses={statuses}
        selection={selectionArg}
        scope={scope}
        selectedCount={selectedCount}
        onDone={onActionComplete}
      />
      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        selection={selectionArg}
        scope={scope}
        selectedCount={selectedCount}
        accountId={accountId}
      />
      {currentListId && (
        <MoveOrCopyDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          currentListId={currentListId}
          accountId={accountId}
          selection={selectionArg}
          selectedCount={selectedCount}
          onDone={onActionComplete}
        />
      )}
      <DeleteContactsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        selection={selectionArg}
        scope={scope}
        selectedCount={selectedCount}
        onDone={onActionComplete}
      />
    </div>
  );
}
