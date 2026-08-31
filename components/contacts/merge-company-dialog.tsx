"use client";

import { useState } from "react";
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
import { createClient } from "@/lib/supabase/client";

/**
 * Backend Schema §7.3 — merge_companies(). "Manual merge, for the cases
 * auto-match can't resolve" — a deliberate user action, not automatic
 * (Implementation Plan Milestone 6). No dedicated Companies screen
 * exists (App Flow has none), so this lives inline on Contact Detail.
 */
export function MergeCompanyDialog({
  open,
  onOpenChange,
  sourceCompanyId,
  sourceCompanyName,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCompanyId: string;
  sourceCompanyName: string;
  accountId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; domain: string | null }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const runSearch = async (value: string) => {
    setSearch(value);
    setSelectedId(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("companies")
      .select("id, name, domain")
      .eq("account_id", accountId)
      .neq("id", sourceCompanyId)
      .is("archived_at", null)
      .ilike("name", `%${value}%`)
      .limit(10);
    setResults(data ?? []);
  };

  const handleMerge = async () => {
    if (!selectedId) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("merge_companies", {
      p_source_company_id: sourceCompanyId,
      p_target_company_id: selectedId,
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Companies merged.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {sourceCompanyName} into another company</DialogTitle>
          <DialogDescription>
            Every contact and opportunity linked to {sourceCompanyName} moves to the company you
            pick below, and this record is archived. This can&apos;t be undone from this screen.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="merge-search">Search companies</Label>
          <Input
            id="merge-search"
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Start typing a company name…"
          />
        </div>

        {results.length > 0 && (
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-neutral-200">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-body hover:bg-neutral-100 ${
                    selectedId === r.id ? "bg-secondary-50" : ""
                  }`}
                >
                  <span className="text-neutral-800">{r.name}</span>
                  {r.domain && <span className="text-body-sm text-neutral-500">{r.domain}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleMerge} disabled={!selectedId || pending}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
