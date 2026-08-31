"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartCriteriaBuilder, type CriteriaOption } from "@/components/lists/smart-criteria-builder";
import type { SmartListCriteria } from "@/lib/lists/criteria";
import { createClient } from "@/lib/supabase/client";

/**
 * App Flow §4.6, F3 — Create/Edit List. Static or smart, chosen at
 * creation (§4.6: "left as a design decision per the client's 'make it
 * clean' direction").
 */
export function ListForm({
  accountId,
  statuses,
  owners,
  companies,
}: {
  accountId: string;
  statuses: CriteriaOption[];
  owners: CriteriaOption[];
  companies: CriteriaOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState<"static" | "smart">("static");
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<SmartListCriteria>({ match: "all", conditions: [] });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Enter a list name.");
      return;
    }
    if (type === "smart" && criteria.conditions.length === 0) {
      setError("Add at least one condition for a smart list.");
      return;
    }
    if (type === "smart" && criteria.conditions.some((c) => !c.value)) {
      setError("Every condition needs a value.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: created, error: createError } = await supabase
      .from("lists")
      .insert({
        account_id: accountId,
        name: name.trim(),
        type,
        criteria: type === "smart" ? criteria : null,
        created_by: user!.id,
      })
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
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Label htmlFor="list-name" required>
          List name
        </Label>
        <Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
      </div>

      <div>
        <Label>Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === "static" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setType("static")}
          >
            Static
          </Button>
          <Button
            type="button"
            variant={type === "smart" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setType("smart")}
          >
            Smart
          </Button>
        </div>
        <p className="mt-2 text-body-sm text-neutral-500">
          {type === "static"
            ? "Manually add contacts — membership only changes when you add or remove them."
            : "Built from filter criteria — membership updates automatically as contacts match."}
        </p>
      </div>

      {type === "smart" && (
        <SmartCriteriaBuilder
          criteria={criteria}
          onChange={setCriteria}
          statuses={statuses}
          owners={owners}
          companies={companies}
        />
      )}

      {error && <p className="text-body-sm text-error-600">{error}</p>}

      <div>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create List"}
        </Button>
      </div>
    </div>
  );
}
