"use client";

import { Building2, Globe, Link as LinkIcon, MapPin, Pencil, Phone, Plus, UserRound, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAddress } from "@/lib/accounts/company-profile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

/**
 * Design System §8.9 "Profile-style content card," Concept A (approved
 * mockup — reverts Concept B's two-column grid back to a single-column
 * icon-label-value list, now with colored navy/teal icon badges
 * instead of flat grey, alternating per row). Matches ProfileForm's
 * identical redesign, since both screens share this card pattern.
 * Client-confirmed gap-fill (App Flow §4.9 never listed a Company
 * Profile screen even though Backend Schema §2 already grants Owner/
 * Admin edit rights on "Accounts (own account settings)"). The logo
 * itself is uploaded from the header above (CompanyLogoUpload), not
 * edited as a field here. Company LinkedIn replaced the original
 * Industry field per client direction — accounts.industry was dropped,
 * not left unused (the separate industry field on the companies table,
 * for CRM company records under Contacts, is untouched).
 *
 * Client-confirmed expansion (2026-09-17): a full mailing address (the
 * old City/State pair plus street, suite and ZIP), a phone number, the
 * CEO's name, and one combined Sales & Marketing list of typed names —
 * all of it also shown, read-only, on the Dashboard's Company Profile
 * card. The "+" on that card links to #sales-marketing here, which opens
 * the form straight into editing with a blank name ready to type.
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

  const address = formatAddress({
    address_street: values.address_street,
    address_suite: values.address_suite,
    address_city: values.address_city,
    address_state: values.address_state,
    address_zip: values.address_zip,
  });
  const savedNames = values.sales_marketing_names.filter((n) => n.trim());

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
        <h2 className="text-h4 text-primary-900">Company Profile</h2>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Update Info
          </Button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-neutral-100">
        <Row icon={Building2} tone="navy" label="Company Name" fieldId="company_name">
          {editing ? <Input id="company_name" value={values.name} onChange={set("name")} /> : <Value>{values.name}</Value>}
        </Row>

        <Row icon={MapPin} tone="teal" label="Address" fieldId="company_street" align="start">
          {editing ? (
            <div className="flex flex-col gap-2">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <Input id="company_street" value={values.address_street} onChange={set("address_street")} placeholder="Street" />
                <Input value={values.address_suite} onChange={set("address_suite")} placeholder="Suite (optional)" aria-label="Suite" />
              </div>
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                <Input value={values.address_city} onChange={set("address_city")} placeholder="City" aria-label="City" />
                <Input value={values.address_state} onChange={set("address_state")} placeholder="State" aria-label="State" />
                <Input value={values.address_zip} onChange={set("address_zip")} placeholder="ZIP" aria-label="ZIP" />
              </div>
            </div>
          ) : (
            <Value>{address}</Value>
          )}
        </Row>

        <Row icon={Phone} tone="navy" label="Phone Number" fieldId="company_phone">
          {editing ? (
            <Input id="company_phone" value={values.phone} onChange={set("phone")} className="max-w-[260px]" />
          ) : (
            <Value>{values.phone}</Value>
          )}
        </Row>

        <Row icon={Globe} tone="teal" label="Website" fieldId="company_website">
          {editing ? (
            <Input id="company_website" value={values.website} onChange={set("website")} />
          ) : values.website ? (
            <a href={values.website} target="_blank" rel="noreferrer" className="block truncate text-body font-medium text-primary-700 hover:underline">
              {values.website}
            </a>
          ) : (
            <Value />
          )}
        </Row>

        <Row icon={LinkIcon} tone="navy" label="Company LinkedIn" fieldId="company_linkedin">
          {editing ? (
            <Input id="company_linkedin" value={values.linkedin_url} onChange={set("linkedin_url")} />
          ) : values.linkedin_url ? (
            <a href={values.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-body font-medium text-primary-700 hover:underline">
              {values.linkedin_url}
            </a>
          ) : (
            <Value />
          )}
        </Row>

        <Row icon={UserRound} tone="teal" label="CEO" fieldId="company_ceo">
          {editing ? (
            <Input id="company_ceo" value={values.ceo_name} onChange={set("ceo_name")} className="max-w-[320px]" />
          ) : (
            <Value>{values.ceo_name}</Value>
          )}
        </Row>

        <div id="sales-marketing" className="scroll-mt-6">
          <Row icon={Users} tone="navy" label="Sales & Marketing" fieldId="company_team_0" align="start">
            {editing ? (
              <div className="flex flex-col items-start gap-2">
                {values.sales_marketing_names.map((person, i) => (
                  <div key={i} className="flex w-full items-center gap-2">
                    <Input
                      id={`company_team_${i}`}
                      value={person}
                      onChange={(e) => setName(i, e.target.value)}
                      placeholder="Full name"
                      aria-label={`Sales & Marketing person ${i + 1}`}
                      className="max-w-[340px]"
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-body-sm font-semibold text-neutral-600 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
                >
                  <Plus className="size-3.5" />
                  Add person
                </button>
              </div>
            ) : savedNames.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {savedNames.map((person, i) => (
                  <li
                    key={`${person}-${i}`}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-body-sm font-medium text-neutral-700"
                  >
                    {person}
                  </li>
                ))}
              </ul>
            ) : (
              <Value />
            )}
          </Row>
        </div>
      </div>

      {editing && (
        <div className="flex justify-end gap-3 px-6 py-4">
          <Button variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  tone,
  label,
  fieldId,
  align = "center",
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: "navy" | "teal";
  label: string;
  fieldId: string;
  align?: "center" | "start";
  children: ReactNode;
}) {
  return (
    <div className={cn("flex gap-4 px-6 py-3.5", align === "center" ? "items-center" : "items-start")}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
          tone === "navy" ? "bg-primary-700" : "bg-secondary-600",
          align === "start" && "mt-0.5"
        )}
      >
        <Icon className="size-4" />
      </span>
      <label htmlFor={fieldId} className={cn("block w-32 shrink-0 text-body text-neutral-800", align === "start" && "pt-2")}>
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <p className="truncate text-body text-neutral-600">{children || "—"}</p>;
}
