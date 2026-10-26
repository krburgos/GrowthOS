"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CompanyFields, EMPTY_COMPANY, ValueTiles, companyColumns, useDomainMatch, type CompanyDraft } from "@/components/companies/new-company-panel";
import { initials } from "@/components/opportunities/new-opportunity-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { employeesOf } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  first_name: z.string().trim().min(1, "Enter a first name."),
  last_name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  status_id: z.string().min(1, "Choose a status."),
  owner_id: z.string().optional(),
  score: z.string().optional(),
  temperature: z.string().optional(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  city: string | null;
  state: string | null;
}

const COMPANY_SELECT = "id, name, industry, company_size, city, state";
const NOBODY = "__nobody__";

function describeCompany(c: CompanyOption) {
  const employees = employeesOf(c.company_size);
  const place = [c.city, c.state].filter(Boolean).join(", ");
  return [c.industry, employees ? `${employees} employees` : null, place || null].filter(Boolean).join(" · ");
}

/**
 * The Contacts page's Add Contact. `?new=1` (the command palette, old
 * /contacts/new links) opens it; closing drops the param so the palette can
 * open it again. The page keys this on that param.
 */
export function AddContactButton({ accountId, defaultOpen = false }: { accountId: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(defaultOpen);
  const close = () => {
    setOpen(false);
    if (!params.has("new")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Add Contact
      </Button>
      {open && <AddContactPanel accountId={accountId} onClose={close} />}
    </>
  );
}

/**
 * Add Contact (client-confirmed, 2026-10-26, approved mockup "CRM Side
 * Panels"): a side panel replacing the Add Contact page. The contact's
 * fields come first; the company is searched for and picked, or added with
 * New company, instead of nine company fields typed every time. From
 * Company Detail the company is filled in and locked.
 *
 * Unchanged from the page: an email that already belongs to a contact in
 * this account updates that contact instead of adding a second one, the
 * import pipeline's rule.
 */
export function AddContactPanel({ accountId, companyId, onClose }: { accountId: string; companyId?: string; onClose: () => void }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string }[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [draft, setDraft] = useState<CompanyDraft | null>(null);
  const match = useDomainMatch(accountId, draft?.website ?? "");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { status_id: "", owner_id: NOBODY } });

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [{ data: statusRows }, { data: ownerRows }, { data: auth }, preset] = await Promise.all([
        supabase.from("contact_statuses").select("id, name").eq("account_id", accountId).is("archived_at", null).order("sort_order"),
        supabase.from("users").select("id, full_name").eq("account_id", accountId).is("archived_at", null).order("full_name"),
        supabase.auth.getUser(),
        companyId
          ? supabase.from("companies").select(COMPANY_SELECT).eq("id", companyId).eq("account_id", accountId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const statusList = (statusRows ?? []) as { id: string; name: string }[];
      const people = (ownerRows ?? []) as { id: string; full_name: string }[];
      setStatuses(statusList);
      setOwners(people);
      if (statusList[0]) setValue("status_id", statusList[0].id);
      const me = auth.user?.id;
      if (me && people.some((p) => p.id === me)) setValue("owner_id", me);
      if (preset.data) setCompany(preset.data as CompanyOption);
    })();
  }, [accountId, companyId, setValue]);

  const onSubmit = async (values: Values) => {
    if (draft && !draft.name.trim()) {
      toast.error("Enter the new company's name, or search instead.");
      return;
    }
    const supabase = createClient();

    let linkedCompanyId: string | null = company?.id ?? null;
    if (draft) {
      const { data, error } = await supabase
        .from("companies")
        .insert({ account_id: accountId, ...companyColumns(draft) })
        .select("id")
        .single();
      if (error || !data) {
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
      linkedCompanyId = data.id;
    }

    const fields = {
      first_name: values.first_name.trim(),
      last_name: values.last_name?.trim() || null,
      title: values.title?.trim() || null,
      phone: values.phone?.trim() || null,
      linkedin_url: values.linkedin_url?.trim() || null,
      status_id: values.status_id,
      owner_id: values.owner_id && values.owner_id !== NOBODY ? values.owner_id : null,
      score: values.score ? Number(values.score) : null,
      temperature: values.temperature || null,
      notes: values.notes?.trim() || null,
    };
    const email = values.email.trim();

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("contacts")
        .update({ ...fields, company_id: linkedCompanyId ?? undefined })
        .eq("id", existing.id);
      if (error) {
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
      toast.success(`${fields.first_name} updated (existing contact with this email).`);
      router.push(`/contacts/${existing.id}`);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert({ account_id: accountId, ...fields, email, company_id: linkedCompanyId, source: "manual" })
      .select("id")
      .single();
    if (error || !inserted) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${fields.first_name} added.`);
    router.push(`/contacts/${inserted.id}`);
  };

  const field = (key: "first_name" | "last_name" | "email" | "title" | "phone" | "linkedin_url" | "score", label: string, opts: { required?: boolean; placeholder?: string; type?: string } = {}) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-body-sm text-neutral-500">
        {label} {opts.required && <span className="text-error-600">*</span>}
      </span>
      <Input type={opts.type} placeholder={opts.placeholder} error={!!errors[key]} {...register(key)} />
      {errors[key] && <span className="text-body-sm text-error-600">{errors[key]?.message}</span>}
    </label>
  );

  const companySize = draft ? draft.company_size : company?.company_size;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
        <DialogHeader className="mb-0 flex flex-col gap-2 border-b border-neutral-100 px-6 pb-4 pt-5 pr-12">
          <p className="text-caption font-semibold text-secondary-700">Contacts</p>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">Who they are, how to reach them, and where they work.</DialogDescription>
        </DialogHeader>

        <form id="add-contact" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("first_name", "First name", { required: true })}
            {field("last_name", "Last name")}
            {field("email", "Email", { required: true, type: "email" })}
            {field("title", "Title")}
            {field("phone", "Work phone", { placeholder: "Optional" })}
            {field("linkedin_url", "Person LinkedIn", { placeholder: "https://linkedin.com/in/…" })}
            <label className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">
                Status <span className="text-error-600">*</span>
              </span>
              {/* Radix reports an empty value while the statuses load; that's not a choice, so it's ignored. */}
              <Select value={watch("status_id")} onValueChange={(v) => v && setValue("status_id", v, { shouldValidate: true })}>
                <SelectTrigger aria-label="Status" error={!!errors.status_id}>
                  <SelectValue placeholder="Loading…" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status_id && <span className="text-body-sm text-error-600">{errors.status_id.message}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">Salesperson</span>
              <Select value={watch("owner_id")} onValueChange={(v) => v && setValue("owner_id", v)}>
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
            {field("score", "Score", { placeholder: "Optional", type: "number" })}
            <label className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">Temp</span>
              <Select value={watch("temperature") ?? ""} onValueChange={(v) => v && setValue("temperature", v)}>
                <SelectTrigger aria-label="Temp">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">Company</span>
            {draft ? (
              <div className="flex flex-col gap-4 rounded-lg border-[1.5px] border-secondary-500 bg-secondary-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm font-semibold text-primary-900">New company</span>
                  <button type="button" onClick={() => setDraft(null)} className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                    Search instead
                  </button>
                </div>
                <CompanyFields
                  draft={draft}
                  onChange={setDraft}
                  match={match}
                  onUseMatch={(m) => {
                    setDraft(null);
                    void createClient()
                      .from("companies")
                      .select(COMPANY_SELECT)
                      .eq("id", m.id)
                      .maybeSingle()
                      .then(({ data }) => data && setCompany(data as CompanyOption));
                  }}
                />
              </div>
            ) : company ? (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  companyId ? "border border-neutral-200 bg-neutral-50" : "border-[1.5px] border-secondary-500 bg-secondary-50"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                  {initials(company.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-primary-900">{company.name}</span>
                  <span className="block truncate text-caption text-neutral-500">{describeCompany(company) || "No details yet"}</span>
                </span>
                {companyId ? (
                  <Lock className="size-4 shrink-0 text-neutral-400" aria-label="Set by this company" />
                ) : (
                  <button type="button" onClick={() => setCompany(null)} className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                    Change
                  </button>
                )}
              </div>
            ) : companyId ? (
              <p className="text-body-sm text-neutral-400">Loading…</p>
            ) : (
              <CompanySearch accountId={accountId} onPick={setCompany} onNew={(name) => setDraft({ ...EMPTY_COMPANY, name })} />
            )}
          </div>

          {(company || draft) && <ValueTiles companySize={companySize} />}

          <label className="flex flex-col gap-1.5">
            <span className="text-body-sm text-neutral-500">Notes</span>
            <Textarea rows={3} placeholder="How you met, what they care about." {...register("notes")} />
          </label>
        </form>

        <DialogFooter className="mt-0 flex-wrap justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="add-contact" disabled={isSubmitting || (!!draft && !!match)}>
            {isSubmitting ? "Adding…" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Type part of a company's name or website; no match offers New company with what was typed. */
function CompanySearch({ accountId, onPick, onNew }: { accountId: string; onPick: (c: CompanyOption) => void; onNew: (name: string) => void }) {
  const [query, setQuery] = useState("");
  // Results are kept with the term they answer; anything else is still searching.
  const [found, setFound] = useState<{ term: string; results: CompanyOption[] } | null>(null);
  // Characters that mean something to the filter syntax are dropped, not escaped.
  const term = query.trim().replace(/[%,()*\\]/g, "");

  useEffect(() => {
    if (term.length < 2) return;
    const q = term;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("companies")
        .select(COMPANY_SELECT)
        .eq("account_id", accountId)
        .is("archived_at", null)
        .or(`name.ilike.%${q}%,website.ilike.%${q}%`)
        .order("name")
        .limit(8);
      if (!cancelled) setFound({ term: q, results: (data ?? []) as CompanyOption[] });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, accountId]);

  const q = query.trim();
  const searching = found?.term !== term;
  const results = searching ? [] : found.results;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex h-9 w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
        <Search className="size-4 shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company name or website"
          aria-label="Search companies"
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
                {initials(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-neutral-900">{c.name}</span>
                <span className="block truncate text-caption text-neutral-500">{describeCompany(c) || "No details yet"}</span>
              </span>
            </button>
          ))}
          <p className="border-t border-neutral-100 px-3 py-2 text-caption text-neutral-400 first:border-t-0">
            {searching ? "Searching…" : results.length === 0 ? `No companies match "${q}"` : `${results.length} ${results.length === 1 ? "company matches" : "companies match"} "${q}"`}
          </p>
          <button
            type="button"
            onClick={() => onNew(q)}
            className="flex w-full items-center gap-2 border-t border-neutral-100 bg-primary-50 px-3 py-2.5 text-left text-body-sm font-semibold text-primary-700 hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none"
          >
            <Plus className="size-4" />
            New company &quot;{q}&quot;
          </button>
        </div>
      )}
    </div>
  );
}
