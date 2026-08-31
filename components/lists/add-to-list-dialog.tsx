"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

/**
 * App Flow §4.6/§4.4 — static list management via bulk-select from the
 * Contacts table (Milestone 6/7). Only static lists accept direct
 * membership inserts — enforced server-side by
 * trg_enforce_static_list_membership (Backend Schema §7.4) — so this
 * dialog only offers static lists.
 */
export function AddToListDialog({
  open,
  onOpenChange,
  contactIds,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  accountId: string;
}) {
  const router = useRouter();
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("lists")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("type", "static")
      .is("archived_at", null)
      .order("name")
      .then(({ data }) => setLists(data ?? []));
  }, [open, accountId]);

  const handleAdd = async () => {
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let listId = selectedListId;

    if (mode === "new") {
      if (!newListName.trim()) {
        setPending(false);
        return;
      }
      const { data: created, error: createError } = await supabase
        .from("lists")
        .insert({ account_id: accountId, name: newListName.trim(), type: "static", created_by: user!.id })
        .select("id")
        .single();
      if (createError) {
        toast.error(createError.message);
        setPending(false);
        return;
      }
      listId = created.id;
    }

    if (!listId) {
      setPending(false);
      return;
    }

    const { error } = await supabase
      .from("list_members")
      .upsert(
        contactIds.map((contactId) => ({ list_id: listId, contact_id: contactId, added_by: user!.id })),
        { onConflict: "list_id,contact_id", ignoreDuplicates: true }
      );

    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Added ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} to the list.`);
    onOpenChange(false);
    setNewListName("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to list</DialogTitle>
          <DialogDescription>
            {contactIds.length} contact{contactIds.length === 1 ? "" : "s"} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "existing" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("existing")}
          >
            Existing list
          </Button>
          <Button
            type="button"
            variant={mode === "new" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("new")}
          >
            New list
          </Button>
        </div>

        {mode === "existing" ? (
          <div>
            <Label htmlFor="existing-list">List</Label>
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger id="existing-list">
                <SelectValue placeholder="Choose a list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label htmlFor="new-list-name" required>
              List name
            </Label>
            <Input id="new-list-name" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={pending || (mode === "existing" ? !selectedListId : !newListName.trim())}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
