"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { ImportWizard } from "@/components/contacts/import-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * "Upload List" — names a new static list, then hands off to the same
 * Import Contacts wizard used everywhere else, targeting that list.
 * Static only: a smart list's membership is computed live from
 * criteria, not something a file upload could populate.
 */
export function CreateListThenUpload({ accountId }: { accountId: string }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [list, setList] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Enter a list name.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: created, error } = await supabase
      .from("lists")
      .insert({ account_id: accountId, name: name.trim(), type: "static", created_by: user!.id })
      .select("id, name")
      .single();
    setPending(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setList(created);
  };

  if (list) {
    return <ImportWizard targetListId={list.id} listName={list.name} />;
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div>
        <Label htmlFor="new-list-upload-name" required>
          List name
        </Label>
        <Input id="new-list-upload-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? "Creating…" : "Continue to Upload"}
        </Button>
      </div>
    </div>
  );
}
