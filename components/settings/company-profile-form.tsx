"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  sales_marketing_names: string[];
}

const CEO_TITLE = "Chief Executive Officer";

/**
 * Company Profile — client-confirmed redesign (2026-09-22, approved mockup
 * "B"): the flat run of nine rows becomes two groups, Company details and
 * People, matching how the information is actually shaped.
 *
 * Three problems this addresses:
 *
 * - Every row led with a coloured square alternating navy, teal, navy, teal
 *   by row position. The colour encoded nothing, so nine saturated chips
 *   were decoration stacked down the page. Gone; the field label does that
 *   work now.
 * - A four-part address sat in a single row carrying the same visual weight
 *   as a phone number. Street and City/State/ZIP are now fields of their
 *   own inside the details group.
 * - Nothing said this page is what the Dashboard hero renders. The People
 *   group says so, and shows the CEO and the team as the same chips the
 *   Dashboard draws.
 *
 * Deliberately NOT inline-edited, unlike My Profile: the address is several
 * fields that are edited together, and the team is a list that grows and
 * shrinks, so one Edit / Save / Cancel for the page is the honest model
 * here. The two screens differ because the data differs.
 *
 * What did not change: which fields exist, the columns they write, the
 * accounts_update RLS that governs them (Backend Schema §6.1), or the
 * Dashboard "+" deep link to #sales-marketing, which still opens this form
 * in edit mode with a blank name ready to type.
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

  // The Dashboard card's "+" deep-links here to add a teammate.
  useEffect(() => {
    if (!canEdit || window.location.hash !== "#sales-marketing") return;
    setEditing(true);
    setValues((v) => ({ ...v, sales_marketing_names: [...v.sales_marketing_names, ""] }));
  }, [canEdit]);

  const set = (field: keyof Omit<Values, "sales_marketing_names">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const setName = (index: number, value: string) =>
    setValues((v) => ({ ...v, sales_marketing_names: v.sales_marketing_names.map((n, i) => (i === index ? value : n)) }));
  const addName = () => setValues((v) => ({ ...v, sales_marketing_names: [...v.sales_marketing_names, ""] }));
  const removeName = (index: number) =>
    setValues((v) => ({ ...v, sales_marketing_names: v.sales_marketing_names.filter((_, i) => i !== index) }));

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
        sales_marketing_names: values.sales_marketing_names.map((n) => n.trim()).filter(Boolean),
      })
      .eq("id", accountId);
    setSaving(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Company profile updated.");
    setEditing(false);
    router.refresh();
  };

  const savedNames = values.sales_marketing_names.filter((n) => n.trim());
  const cityLine = [values.address_city, [values.address_state, values.address_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Company details"
        action={
          canEdit && !editing ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 size-4" />
              Edit
            </Button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-x-8 px-6 py-3 sm:grid-cols-2">
          <Field label="Company name" fieldId="company_name">
            {editing ? <Input id="company_name" value={values.name} onChange={set("name")} /> : <Value>{values.name}</Value>}
          </Field>

          <Field label="Phone" fieldId="company_phone">
            {editing ? (
              <Input id="company_phone" value={values.phone} onChange={set("phone")} />
            ) : (
              <Value>{values.phone}</Value>
            )}
          </Field>

          <Field label="Website" fieldId="company_website">
            {editing ? (
              <Input id="company_website" value={values.website} onChange={set("website")} />
            ) : values.website ? (
              <ExternalValue href={values.website}>{values.website}</ExternalValue>
            ) : (
              <Value />
            )}
          </Field>

          <Field label="LinkedIn" fieldId="company_linkedin">
            {editing ? (
              <Input id="company_linkedin" value={values.linkedin_url} onChange={set("linkedin_url")} />
            ) : values.linkedin_url ? (
              <ExternalValue href={values.linkedin_url}>{values.linkedin_url}</ExternalValue>
            ) : (
              <Value />
            )}
          </Field>

          <Field label="Street" fieldId="company_street">
            {editing ? (
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <Input id="company_street" value={values.address_street} onChange={set("address_street")} placeholder="Street" />
                <Input value={values.address_suite} onChange={set("address_suite")} placeholder="Suite" aria-label="Suite" />
              </div>
            ) : (
              <Value>{[values.address_street, values.address_suite].filter(Boolean).join(", ")}</Value>
            )}
          </Field>

          <Field label="City, State ZIP" fieldId="company_city">
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
        </div>
      </Card>

      <Card title="People" hint="Shown on the Dashboard">
        <div className="flex flex-col gap-5 px-6 py-4">
          <div>
            <p className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-neutral-400">{CEO_TITLE}</p>
            {editing ? (
              <Input
                id="company_ceo"
                value={values.ceo_name}
                onChange={set("ceo_name")}
                placeholder="Full name"
                aria-label="CEO name"
                className="max-w-[340px]"
              />
            ) : values.ceo_name ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-secondary-700 text-caption font-semibold text-white">
                  {initials(values.ceo_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-neutral-800">{values.ceo_name}</p>
                  <p className="text-caption text-neutral-500">{CEO_TITLE}</p>
                </div>
              </div>
            ) : (
              <Value />
            )}
          </div>

          <div id="sales-marketing" className="scroll-mt-6">
            <p className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-neutral-400">Sales &amp; Marketing</p>
            {editing ? (
              <div className="flex flex-col items-start gap-2">
                {values.sales_marketing_names.map((person, i) => (
                  <div key={i} className="flex w-full max-w-[400px] items-center gap-2">
                    <Input
                      id={`company_team_${i}`}
                      value={person}
                      onChange={(e) => setName(i, e.target.value)}
                      placeholder="Full name"
                      aria-label={`Sales & Marketing person ${i + 1}`}
                      autoFocus={i === values.sales_marketing_names.length - 1 && person === ""}
                    />
                    <button
                      type="button"
                      onClick={() => removeName(i)}
                      aria-label={`Remove ${person || "this person"}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-error-100 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addName}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3.5 py-1.5 text-body-sm font-semibold text-neutral-600 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
                >
                  <Plus className="size-3.5" />
                  Add person
                </button>
              </div>
            ) : savedNames.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {savedNames.map((person, i) => (
                  <li
                    key={`${person}-${i}`}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-1 pr-3.5 text-body-sm font-medium text-neutral-700"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-semibold text-secondary-800">
                      {initials(person)}
                    </span>
                    {person}
                  </li>
                ))}
              </ul>
            ) : (
              <Value />
            )}
          </div>
        </div>
      </Card>

      {editing && (
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-6 py-4">
        <h2 className="text-h4 text-primary-900">{title}</h2>
        {action}
        {hint && !action && <p className="text-caption text-neutral-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, fieldId, children }: { label: string; fieldId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <label htmlFor={fieldId} className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return (
    <p className="flex min-h-8 items-center truncate text-body text-neutral-800">
      {children || <span className="text-neutral-300">Not set</span>}
    </p>
  );
}

function ExternalValue({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="flex min-h-8 items-center">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="truncate text-body font-medium text-primary-700 hover:underline"
      >
        {children}
      </a>
    </p>
  );
}
