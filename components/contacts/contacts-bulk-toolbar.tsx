"use client";

import { ChevronDown, Mail, Trash2, X } from "lucide-react";
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

  // Client-confirmed (2026-10-14, "CRM Pages Refresh"): the bar floats at
  // the foot of the screen, so it stays in reach while the table scrolls,
  // and Assign / Mark as / Add to list sit on it directly instead of under
  // "More Actions". On a phone it wraps to two rows above the home bar.
  const action =
    "h-8 gap-1.5 px-2.5 text-body-sm text-white hover:bg-white/20 hover:text-white active:bg-white/30";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
      <div
        role="region"
        aria-label="Bulk actions"
        className="pointer-events-auto flex w-full max-w-[920px] flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] px-3 py-2 shadow-[0_20px_40px_-16px_rgba(2,20,50,0.6)]"
      >
        <span className="mr-1 text-body-sm font-semibold tabular-nums text-white">
          {selectedCount} selected
        </span>
        {!selection.selectAllMatching && totalCount > selection.selectedIds.size && (
          <button type="button" onClick={onSelectAllMatching} className="mr-2 text-body-sm font-semibold text-secondary-300 hover:underline">
            Select all {totalCount.toLocaleString()}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => toast("Email requires Campaigns (Milestone 10), not set up yet.")}
            aria-label="Email selected contacts"
            className={action}
          >
            <Mail className="size-4" />
            Email
          </Button>
          <ExportContactsButton selection={selectionArg} scope={scope} />
          <Button type="button" variant="ghost" onClick={() => setAssignOpen(true)} className={action}>
            Assign
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMarkStatusOpen(true)} className={action}>
            Mark as
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAddToListOpen(true)} className={action}>
            Add to list
          </Button>
          {currentListId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className={action}>
                  This list
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setMoveOpen(true)}>Move to</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleRemoveFromList} disabled={removing}>
                  Remove from this list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete selected contacts"
            className="h-8 gap-1.5 px-2.5 text-body-sm text-error-300 hover:bg-error-400/20 hover:text-error-200"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-auto flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" />
        </button>
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
