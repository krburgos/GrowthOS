"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * App Flow §5.4 — "Create Opportunity" from a contact's Opportunities
 * tab, pre-filled with that contact, appearing on the Board at
 * Identified Interest (Backend Schema §5.5 default).
 */
export function OpportunityCreateForm({
  accountId,
  contactId,
  contactName,
}: {
  accountId: string;
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: created, error: createError } = await supabase
      .from("opportunities")
      .insert({
        account_id: accountId,
        contact_id: contactId,
        owner_id: user!.id,
        name: name || null,
        value: value ? Number(value) : null,
      })
      .select("id")
      .single();

    setPending(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    toast.success("Opportunity created.");
    router.push(`/opportunities/${created.id}`);
  };

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-body text-neutral-600">
        For <span className="font-medium text-neutral-800">{contactName}</span>
      </p>
      <div>
        <Label htmlFor="new-opp-name">Name (optional)</Label>
        <Input id="new-opp-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-opp-value">Value</Label>
        <Input id="new-opp-value" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      {error && <p className="text-body-sm text-error-600">{error}</p>}
      <div>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create Opportunity"}
        </Button>
      </div>
    </div>
  );
}
