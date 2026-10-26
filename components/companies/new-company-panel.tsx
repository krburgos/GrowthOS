"use client";

import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeDomain } from "@/lib/companies/domain";
import { opportunitiesValue, prospectValue, usd } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface CompanyDraft {
  name: string;
  website: string;
  linkedin_url: string;
  industry: string;
  company_size: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
}

export const EMPTY_COMPANY: CompanyDraft = {
  name: "",
  website: "",
  linkedin_url: "",
  industry: "",
  company_size: "",
  phone: "",
  address_line1: "",
  city: "",
  state: "",
};

/** The company row for an insert or update: blanks are stored as null. */
export function companyColumns(d: CompanyDraft) {
  const v = (s: string) => s.trim() || null;
  return {
    name: d.name.trim(),
    website: v(d.website),
    domain: normalizeDomain(d.website),
    linkedin_url: v(d.linkedin_url),
    industry: v(d.industry),
    company_size: v(d.company_size),
    phone: v(d.phone),
    address_line1: v(d.address_line1),
    city: v(d.city),
    state: v(d.state),
  };
}

/** The company already using this website, if any: one company per domain (Backend Schema §7.3). */
export function useDomainMatch(accountId: string, website: string) {
  // Kept with the domain it was found for, so an edited website never shows a stale match.
  const [found, setFound] = useState<{ domain: string; match: { id: string; name: string } | null } | null>(null);
  const domain = normalizeDomain(website);
  useEffect(() => {
    if (!domain) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("companies")
        .select("id, name")
        .eq("account_id", accountId)
        .eq("domain", domain)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setFound({ domain, match: (data as { id: string; name: string } | null) ?? null });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [accountId, domain]);
  return domain && found?.domain === domain ? found.match : null;
}

/**
 * The eight company fields, shared by New Company and Add Contact's New
 * company section. A website another company already uses is named under
 * the field, with a link to it, or, in Add Contact, a button to use it.
 */
export function CompanyFields({
  draft,
  onChange,
  match,
  onUseMatch,
}: {
  draft: CompanyDraft;
  onChange: (d: CompanyDraft) => void;
  match: { id: string; name: string } | null;
  /** Add Contact: link the contact to the matching company instead. */
  onUseMatch?: (match: { id: string; name: string }) => void;
}) {
  const field = (key: keyof CompanyDraft, label: string, opts: { required?: boolean; placeholder?: string; wide?: boolean; numeric?: boolean } = {}) => (
    <label className={cn("flex flex-col gap-1.5", opts.wide && "sm:col-span-2")}>
      <span className="text-body-sm text-neutral-500">
        {label} {opts.required && <span className="text-error-600">*</span>}
      </span>
      <Input
        value={draft[key]}
        onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
        placeholder={opts.placeholder}
        inputMode={opts.numeric ? "numeric" : undefined}
      />
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {field("name", "Company name", { required: true, wide: true })}
      <div className="flex flex-col gap-2 sm:col-span-2">
        {field("website", "Website", { placeholder: "Optional" })}
        {match && (
          <div className="flex items-center gap-2.5 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5">
            <AlertCircle className="size-4 shrink-0 text-warning-800" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-body-sm text-warning-900">
              <b className="font-semibold">{match.name}</b> already uses this website.
            </span>
            {onUseMatch ? (
              <button type="button" onClick={() => onUseMatch(match)} className="shrink-0 text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                Use it
              </button>
            ) : (
              <Link href={`/companies/${match.id}`} className="shrink-0 text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                Open it
              </Link>
            )}
          </div>
        )}
      </div>
      {field("industry", "Industry", { placeholder: "Optional" })}
      {field("company_size", "Employees", { placeholder: "Optional", numeric: true })}
      {field("linkedin_url", "Company LinkedIn", { placeholder: "https://linkedin.com/company/…" })}
      {field("phone", "Company phone", { placeholder: "Optional" })}
      {field("address_line1", "Address", { placeholder: "Optional", wide: true })}
      {field("city", "City", { placeholder: "Optional" })}
      {field("state", "State", { placeholder: "Optional" })}
    </div>
  );
}

/** Prospect Value and Opportunities Value from an Employees figure, label and number only. */
export function ValueTiles({ companySize }: { companySize: string | number | null | undefined }) {
  const pv = prospectValue(companySize);
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary-200 bg-primary-200">
      <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
        <span className="text-caption text-primary-700">Prospect Value</span>
        <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>{pv ? usd.format(pv) : "—"}</span>
      </div>
      <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
        <span className="text-caption text-primary-700">Opportunities Value</span>
        <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>
          {pv ? usd.format(opportunitiesValue(companySize)) : "—"}
        </span>
      </div>
    </div>
  );
}

/**
 * New Company (client-confirmed, 2026-10-26, approved mockup "CRM Side
 * Panels"): reverses App Flow D5's "No Add Company". A side panel, the New
 * Opportunity panel's pattern; a website another company already uses
 * blocks Create and links to that company instead of making a second one.
 * Create opens the new Company Detail.
 */
export function NewCompanyButton({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        New Company
      </Button>
      {open && <NewCompanyPanel accountId={accountId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewCompanyPanel({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);
  const match = useDomainMatch(accountId, draft.website);

  const create = async () => {
    if (!draft.name.trim()) {
      toast.error("Enter the company's name.");
      return;
    }
    setSaving(true);
    const { data, error } = await createClient()
      .from("companies")
      .insert({ account_id: accountId, ...companyColumns(draft) })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${draft.name.trim()} added.`);
    router.push(`/companies/${data.id}`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
        <DialogHeader className="mb-0 flex flex-col gap-2 border-b border-neutral-100 px-6 pb-4 pt-5 pr-12">
          <p className="text-caption font-semibold text-secondary-700">Companies</p>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">Who they are, how big they are, and where they&apos;re based.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <CompanyFields draft={draft} onChange={setDraft} match={match} />
          <ValueTiles companySize={draft.company_size} />
        </div>

        <DialogFooter className="mt-0 flex-wrap justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={saving || !draft.name.trim() || !!match}>
            {saving ? "Creating…" : "Create company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
