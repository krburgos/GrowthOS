"use client";

import { useState } from "react";

import { AddContactsToListDialog } from "@/components/lists/add-contacts-to-list-dialog";
import { Button } from "@/components/ui/button";

export function AddContactsButton({ listId, accountId }: { listId: string; accountId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add Contacts
      </Button>
      <AddContactsToListDialog open={open} onOpenChange={setOpen} listId={listId} accountId={accountId} />
    </>
  );
}
