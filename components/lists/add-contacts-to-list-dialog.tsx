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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AddContactsToListDialog({
  open,
  onOpenChange,
  listId,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  accountId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const runSearch = async (value: string) => {
    setSearch(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .or(`full_name.ilike.%${value}%,email.ilike.%${value}%`)
      .limit(20);
    setResults(data ?? []);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("list_members")
      .upsert(
        [...selected].map((contactId) => ({ list_id: listId, contact_id: contactId, added_by: user!.id })),
        { onConflict: "list_id,contact_id", ignoreDuplicates: true }
      );

    if (!error) {
      // Re-adding overrides any earlier exclusion on a smart list
      // (Backend Schema §7.4) — a no-op for static lists.
      await supabase.from("list_exclusions").delete().eq("list_id", listId).in("contact_id", [...selected]);
    }
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${selected.size} contact${selected.size === 1 ? "" : "s"}.`);
    setSelected(new Set());
    setSearch("");
    setResults([]);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contacts to list</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="add-contacts-search">Search contacts</Label>
          <Input
            id="add-contacts-search"
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Name or email…"
          />
        </div>

        {results.length > 0 && (
          <ul className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-neutral-200">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-body hover:bg-neutral-100 ${
                    selected.has(r.id) ? "bg-secondary-50" : ""
                  }`}
                >
                  <span className="text-neutral-800">{r.full_name}</span>
                  <span className="text-body-sm text-neutral-500">{r.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0 || pending}>
            Add {selected.size > 0 ? selected.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
