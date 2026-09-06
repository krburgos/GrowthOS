"use client";

import { ListChecks, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import { Button } from "@/components/ui/button";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

export interface ContactListMembership {
  id: string;
  name: string;
}

/**
 * Client-confirmed (Contact Detail redesign, follow-up): a contact can
 * belong to multiple lists, so this card shows every list it's
 * currently a member of, resolved server-side in the page component.
 * Add reuses AddToListDialog as-is (it already works from a plain
 * `{selectedIds: [contactId]}` selection). Removing deletes the
 * `list_members` row.
 */
export function ContactListsCard({
  contactId,
  accountId,
  memberships,
}: {
  contactId: string;
  accountId: string;
  memberships: ContactListMembership[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (list: ContactListMembership) => {
    setRemovingId(list.id);
    const supabase = createClient();
    const { error } = await supabase.from("list_members").delete().eq("list_id", list.id).eq("contact_id", contactId);
    setRemovingId(null);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    toast.success(`Removed from ${list.name}.`);
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Lists</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add to list
        </Button>
      </div>

      {memberships.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-body-sm text-neutral-500">
          <ListChecks className="size-4 text-neutral-400" />
          Not in any lists yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {memberships.map((list) => (
            <li key={list.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 truncate text-body text-neutral-800">{list.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(list)}
                disabled={removingId === list.id}
                aria-label={`Remove from ${list.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-error-100 hover:text-error-700 disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddToListDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        selection={{ selectAllMatching: false, selectedIds: [contactId] }}
        scope={{ mode: "all-contacts", accountId }}
        selectedCount={1}
        accountId={accountId}
      />
    </div>
  );
}
