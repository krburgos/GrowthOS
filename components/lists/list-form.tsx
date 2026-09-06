"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * App Flow §4.6, F3 — Create List. Client-confirmed removal (2026-09-
 * 06): Smart Lists (criteria-based, auto-updating membership) were
 * removed entirely — "My customers want to manually add contacts to a
 * list." A list is now always the plain, manually-curated kind: create
 * it here, then add/remove contacts from List Detail, the Contacts
 * bulk toolbar, or Upload.
 */
export function ListForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Enter a list name.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: created, error: createError } = await supabase
      .from("lists")
      .insert({ account_id: accountId, name: name.trim(), created_by: user!.id })
      .select("id")
      .single();

    setPending(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    toast.success(`${name} created.`);
    router.push(`/lists/${created.id}`);
  };

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <Label htmlFor="list-name" required>
          List name
        </Label>
        <Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {error && <p className="text-body-sm text-error-600">{error}</p>}

      <div>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create List"}
        </Button>
      </div>
    </div>
  );
}
