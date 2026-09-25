"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/accounts/company-profile";
import { createClient } from "@/lib/supabase/client";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

interface Values {
  name: string;
  website: string;
  linkedin_url: string;
  phone: string;
  ceo_name: string;
  address_street: string;
  address_suite: string;
  address_city: string;
  address_state: string;
  address_zip: string;
}

const CEO_TITLE = "Chief Executive Officer";

/**
 * The company's own record — the facts about the business, in a two-column
 * grid (client-confirmed redesign, 2026-09-25).
 *
 * Two things changed here with that redesign:
 *
 * - **The Sales & Marketing editor is gone.** It was still writing typed
 *   names to `accounts.sales_marketing_names`, which nothing has read since
 *   the team roster replaced it — so the page carried two editors for the
 *   same thing and one of them silently did nothing. The roster
 *   (`TeamRoster`) is now the only place people are managed.
 * - **The CEO moved into this card.** They had been stranded in a "People"
 *   card beside the rosters, which made them read like a fourteenth
 *   workstream assignee. A chief executive is a fact about the company, the
 *   same kind of thing as its phone number.
 *
 * Which fields exist, the columns they write, and the accounts_update RLS
 * that governs them (Backend Schema §6.1) are all unchanged.
 */
export function CompanyProfileForm({
  accountId,
  canEdit,
  defaults,
}: {
  accountId: string;
  canEdit: boolean;
  defaults: Values;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(defaults);

  const set = (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleCancel = () => {
    setValues(defaults);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .update({
        name: values.name,
        website: values.website || null,
        linkedin_url: values.linkedin_url || null,
        phone: values.phone || null,
        ceo_name: values.ceo_name || null,
        address_street: values.address_street || null,
        address_suite: values.address_suite || null,
        address_city: values.address_city || null,
        address_state: values.address_state || null,
        address_zip: values.address_zip || null,
      })
      .eq("id", accountId);
    setSaving(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Company details saved.");
    setEditing(false);
    router.refresh();
  };

  const cityLine = [values.address_city, [values.address_state, values.address_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
        <h2 className="text-h4 text-primary-900">Company details</h2>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Button>
        )}
        {editing && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-8 px-5 pb-4 pt-1 sm:grid-cols-2">
        <Field label="Company name" id="company_name">
          {editing ? <Input id="company_name" value={values.name} onChange={set("name")} /> : <Value>{values.name}</Value>}
        </Field>

        <Field label="Phone" id="company_phone">
          {editing ? <Input id="company_phone" value={values.phone} onChange={set("phone")} /> : <Value>{values.phone}</Value>}
        </Field>

        <Field label="Website" id="company_website">
          {editing ? (
            <Input id="company_website" value={values.website} onChange={set("website")} />
          ) : (
            <LinkValue href={values.website} />
          )}
        </Field>

        <Field label="LinkedIn" id="company_linkedin">
          {editing ? (
            <Input id="company_linkedin" value={values.linkedin_url} onChange={set("linkedin_url")} />
          ) : (
            <LinkValue href={values.linkedin_url} />
          )}
        </Field>

        <Field label="Street" id="company_street">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <Input id="company_street" value={values.address_street} onChange={set("address_street")} placeholder="Street" />
              <Input value={values.address_suite} onChange={set("address_suite")} placeholder="Suite" aria-label="Suite" />
            </div>
          ) : (
            <Value>{[values.address_street, values.address_suite].filter(Boolean).join(", ")}</Value>
          )}
        </Field>

        <Field label="City, state and ZIP" id="company_city">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <Input id="company_city" value={values.address_city} onChange={set("address_city")} placeholder="City" />
              <Input value={values.address_state} onChange={set("address_state")} placeholder="State" aria-label="State" />
              <Input value={values.address_zip} onChange={set("address_zip")} placeholder="ZIP" aria-label="ZIP" />
            </div>
          ) : (
            <Value>{cityLine}</Value>
          )}
        </Field>

        <div className="border-t border-neutral-100 pt-3.5 sm:col-span-2">
          <p className="mb-2 text-body-sm text-neutral-500">Chief executive</p>
          {editing ? (
            <Input
              id="company_ceo"
              value={values.ceo_name}
              onChange={set("ceo_name")}
              placeholder="Full name"
              aria-label="Chief executive"
              className="max-w-[340px]"
            />
          ) : values.ceo_name ? (
            <div className="flex items-center gap-3">
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-secondary-700 text-body-sm font-bold text-white">
                {initials(values.ceo_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold text-neutral-800">{values.ceo_name}</span>
                <span className="block text-caption text-neutral-500">{CEO_TITLE}</span>
              </span>
            </div>
          ) : (
            <Value />
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="border-b border-neutral-100 py-3">
      <label htmlFor={id} className="mb-1 block text-body-sm text-neutral-500">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return (
    <p className="flex min-h-8 items-center truncate text-body font-medium text-neutral-800">
      {children || <span className="font-normal text-neutral-300">Not set</span>}
    </p>
  );
}

function LinkValue({ href }: { href: string }) {
  if (!href) return <Value />;
  return (
    <p className="flex min-h-8 items-center">
      <a
        href={/^https?:\/\//i.test(href) ? href : `https://${href}`}
        target="_blank"
        rel="noreferrer"
        className="truncate text-body font-medium text-primary-700 hover:underline"
      >
        {href.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
      </a>
    </p>
  );
}
