"use client";

import { Lock, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OPPORTUNITY_TEXT_MAX, TypeInput, rememberType } from "@/components/opportunities/type-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { employeesOf, opportunitiesValue, prospectValue, usd } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface ContactOption {
  id: string;
  full_name: string;
  title: string | null;
  companyName: string | null;
  companySize: string | number | null;
}

interface StageOption {
  id: string;
  name: string;
  win_probability: number;
}

const NOBODY = "__nobody__";

export type ContactRow = {
  id: string;
  full_name: string;
  title: string | null;
  companies: { name: string; company_size: string | number | null } | { name: string; company_size: string | number | null }[] | null;
};

export function toOption(r: ContactRow): ContactOption {
  const co = Array.isArray(r.companies) ? r.companies[0] : r.companies;
  return { id: r.id, full_name: r.full_name, title: r.title, companyName: co?.name ?? null, companySize: co?.company_size ?? null };
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase();
}

export function describe(c: ContactOption) {
  const employees = employeesOf(c.companySize);
  return [c.title, c.companyName, employees ? `${employees} employees` : null].filter(Boolean).join(" · ");
}

/**
 * New Opportunity (client-confirmed, 2026-10-20, approved mockup "New
 * Opportunity Panel"): a side panel over the page, the Mission Order
 * panel's pattern, replacing the separate Create Opportunity page that
 * only worked when a contact was already chosen.
 *
 * Pick a contact (or arrive with one, locked, from Contact Detail) and the
 * value is worked out from their company's size: Prospect Value, employees
 * × 12 × $200, the same figure shown everywhere else — no longer typed.
 * Stages, salespeople and a preset contact load when the panel opens.
 */
export function NewOpportunityButton({
  accountId,
  contactId,
  size,
  defaultOpen = false,
}: {
  accountId: string;
  /** From Contact Detail: the contact, filled in and locked. */
  contactId?: string;
  size?: "sm";
  /** Old /opportunities/new links land on the Opportunities page with the panel open. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        {contactId ? "Create Opportunity" : "New Opportunity"}
      </Button>
      {open && <NewOpportunityPanel accountId={accountId} contactId={contactId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewOpportunityPanel({ accountId, contactId, onClose }: { accountId: string; contactId?: string; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [stages, setStages] = useState<StageOption[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string }[]>([]);
  const [contact, setContact] = useState<ContactOption | null>(null);
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState(NOBODY);
  const [name, setName] = useState("");
  // Required since 2026-10-26: filled in with the company's name when a contact is
  // chosen, as a real value to keep or change, until the person types their own.
  const [nameTouched, setNameTouched] = useState(false);
  const pick = (c: ContactOption | null) => {
    setContact(c);
    if (c && !nameTouched) setName((c.companyName ?? c.full_name).slice(0, OPPORTUNITY_TEXT_MAX));
  };
  const [notes, setNotes] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [{ data: stageRows }, { data: ownerRows }, { data: auth }, preset] = await Promise.all([
        supabase
          .from("opportunity_stages")
          .select("id, name, stage_group, win_probability")
          .eq("account_id", accountId)
          .is("archived_at", null)
          .order("sort_order"),
        supabase.from("users").select("id, full_name").eq("account_id", accountId).is("archived_at", null).order("full_name"),
        supabase.auth.getUser(),
        contactId
          ? supabase.from("contacts").select("id, full_name, title, companies(name, company_size)").eq("id", contactId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const open = ((stageRows ?? []) as (StageOption & { stage_group: string })[]).filter((s) => s.stage_group === "open");
      setStages(open);
      if (open[0]) setStageId(open[0].id);
      const people = (ownerRows ?? []) as { id: string; full_name: string }[];
      setOwners(people);
      const me = auth.user?.id;
      if (me && people.some((p) => p.id === me)) setOwnerId(me);
      if (preset.data) {
        const c = toOption(preset.data as ContactRow);
        setContact(c);
        setName((c.companyName ?? c.full_name).slice(0, OPPORTUNITY_TEXT_MAX));
      }
    })();
  }, [accountId, contactId]);

  const pv = contact ? prospectValue(contact.companySize) : 0;

  const create = async () => {
    if (!contact) {
      toast.error("Choose who the opportunity is with.");
      return;
    }
    if (!name.trim()) {
      toast.error("Give the opportunity a name.");
      return;
    }
    setSaving(true);
    const { data, error } = await createClient()
      .from("opportunities")
      .insert({
        account_id: accountId,
        contact_id: contact.id,
        owner_id: ownerId === NOBODY ? null : ownerId,
        name: name.trim(),
        value: pv || null,
        stage_id: stageId || null,
        notes: notes.trim() || null,
        type: type.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    rememberType(accountId, type);
    toast.success("Opportunity created.");
    // Opens the new opportunity in its panel, on this page (Edit Opportunity, 2026-10-26).
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    next.set("opportunity", data.id);
    onClose();
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
        <DialogHeader className="mb-0 flex flex-col gap-2 border-b border-neutral-100 px-6 pb-4 pt-5 pr-12">
          <p className="text-caption font-semibold text-secondary-700">Opportunities</p>
          <DialogTitle>New opportunity</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">Who it&apos;s with, where it stands, and who owns it.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">
              Contact {!contactId && <span className="text-error-600">*</span>}
            </span>
            {contact ? (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  contactId ? "border border-neutral-200 bg-neutral-50" : "border-[1.5px] border-secondary-500 bg-secondary-50"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                  {initials(contact.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-primary-900">{contact.full_name}</span>
                  <span className="block truncate text-caption text-neutral-500">{describe(contact)}</span>
                </span>
                {contactId ? (
                  <Lock className="size-4 shrink-0 text-neutral-400" aria-label="Set by this contact" />
                ) : (
                  <button type="button" onClick={() => pick(null)} className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                    Change
                  </button>
                )}
              </div>
            ) : contactId ? (
              <p className="text-body-sm text-neutral-400">Loading…</p>
            ) : (
              <ContactSearch accountId={accountId} onPick={pick} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary-200 bg-primary-200">
            <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
              <span className="text-caption text-primary-700">Prospect Value</span>
              <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>{pv ? usd.format(pv) : "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
              <span className="text-caption text-primary-700">Opportunities Value</span>
              <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>
                {pv ? usd.format(opportunitiesValue(contact?.companySize)) : "—"}
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">
              Opportunity name <span className="text-error-600">*</span>
            </span>
            <Input
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder="Name this opportunity"
              maxLength={OPPORTUNITY_TEXT_MAX}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">Type</span>
            <TypeInput accountId={accountId} value={type} onChange={setType} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">Stage</span>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger aria-label="Stage">
                  <SelectValue placeholder="Loading…">
                    {/* The name only: the list beside it shows each win %. */}
                    <span className="block truncate">{stages.find((s) => s.id === stageId)?.name}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span>{s.name}</span>
                        <span className="text-caption tabular-nums text-neutral-400">{s.win_probability}%</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">Salesperson</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger aria-label="Salesperson">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">Notes</span>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they're interested in, and what happens next." />
          </label>
        </div>

        <DialogFooter className="mt-0 flex-wrap justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={saving || !contact || !name.trim()}>
            {saving ? "Creating…" : "Create opportunity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Type part of a name, email or company; each result says who and where they are. */
function ContactSearch({ accountId, onPick }: { accountId: string; onPick: (c: ContactOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Characters that mean something to the filter syntax are dropped, not escaped.
    const q = query.trim().replace(/[%,()*\\]/g, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const supabase = createClient();
      const SELECT = "id, full_name, title, companies(name, company_size)";
      const [{ data: byPerson }, { data: companies }] = await Promise.all([
        supabase
          .from("contacts")
          .select(SELECT)
          .eq("account_id", accountId)
          .is("archived_at", null)
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(8),
        supabase.from("companies").select("id").eq("account_id", accountId).is("archived_at", null).ilike("name", `%${q}%`).limit(20),
      ]);
      const companyIds = ((companies ?? []) as { id: string }[]).map((c) => c.id);
      const { data: byCompany } = companyIds.length
        ? await supabase.from("contacts").select(SELECT).eq("account_id", accountId).is("archived_at", null).in("company_id", companyIds).limit(8)
        : { data: [] };
      if (cancelled) return;
      const seen = new Set<string>();
      const merged = [...((byPerson ?? []) as ContactRow[]), ...((byCompany ?? []) as ContactRow[])]
        .filter((r) => !seen.has(r.id) && seen.add(r.id))
        .slice(0, 8)
        .map(toOption);
      setResults(merged);
      setSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, accountId]);

  const q = query.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex h-9 w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
        <Search className="size-4 shrink-0 text-neutral-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or company"
          aria-label="Search contacts"
          className="min-w-0 flex-1 bg-transparent text-body text-neutral-800 outline-none placeholder:text-neutral-400"
        />
      </label>
      {q.length >= 2 && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 border-t border-neutral-100 px-3 py-2.5 text-left first:border-t-0 hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                {initials(c.full_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-neutral-900">{c.full_name}</span>
                <span className="block truncate text-caption text-neutral-500">{describe(c) || "No company"}</span>
              </span>
            </button>
          ))}
          <p className="border-t border-neutral-100 px-3 py-2 text-caption text-neutral-400">
            {searching ? "Searching…" : results.length === 0 ? `No contacts match "${q}"` : `${results.length} ${results.length === 1 ? "contact matches" : "contacts match"} "${q}"`}
          </p>
        </div>
      )}
    </div>
  );
}
