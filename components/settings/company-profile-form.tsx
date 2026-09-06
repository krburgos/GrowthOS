"use client";

import { Building2, Globe, Link as LinkIcon, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface Values {
  name: string;
  website: string;
  linkedin_url: string;
  address_city: string;
  address_state: string;
}

/**
 * Design System §8.9 "Profile-style content card," Concept B (approved
 * mockup): a two-column sectioned grid with small teal icon chips,
 * replacing the original single-column icon-label-value list —
 * matches ProfileForm's identical redesign, since both screens share
 * this card pattern. Client-confirmed gap-fill (App Flow §4.9 never
 * listed a Company Profile screen even though Backend Schema §2 already
 * grants Owner/Admin edit rights on "Accounts (own account settings)").
 * The logo itself is uploaded from the header above (CompanyLogoUpload),
 * not edited as a field here. Company LinkedIn replaced the original
 * Industry field per client direction — accounts.industry was dropped,
 * not left unused (the separate industry field on the companies table,
 * for CRM company records under Contacts, is untouched).
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
        address_city: values.address_city || null,
        address_state: values.address_state || null,
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

  const location = [values.address_city, values.address_state].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Company Profile</h2>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Update Info
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-neutral-100 p-5 pt-3 sm:grid-cols-2">
        <Cell icon={Building2} label="Company Name" fieldId="company_name">
          {editing ? <Input id="company_name" value={values.name} onChange={set("name")} /> : <Value>{values.name}</Value>}
        </Cell>
        <Cell icon={Globe} label="Website" fieldId="company_website">
          {editing ? (
            <Input id="company_website" value={values.website} onChange={set("website")} />
          ) : values.website ? (
            <a href={values.website} target="_blank" rel="noreferrer" className="truncate text-body font-medium text-primary-700 hover:underline">
              {values.website}
            </a>
          ) : (
            <Value />
          )}
        </Cell>
        <Cell icon={LinkIcon} label="Company LinkedIn" fieldId="company_linkedin">
          {editing ? (
            <Input id="company_linkedin" value={values.linkedin_url} onChange={set("linkedin_url")} />
          ) : values.linkedin_url ? (
            <a href={values.linkedin_url} target="_blank" rel="noreferrer" className="truncate text-body font-medium text-primary-700 hover:underline">
              {values.linkedin_url}
            </a>
          ) : (
            <Value />
          )}
        </Cell>
        <Cell icon={MapPin} label="Location" fieldId="company_city">
          {editing ? (
            <div className="flex gap-2">
              <Input id="company_city" value={values.address_city} onChange={set("address_city")} placeholder="City" />
              <Input value={values.address_state} onChange={set("address_state")} placeholder="State" aria-label="State" />
            </div>
          ) : (
            <Value>{location}</Value>
          )}
        </Cell>
      </div>

      {editing && (
        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4">
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

function Cell({
  icon: Icon,
  label,
  fieldId,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 bg-white p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary-50 text-secondary-700">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={fieldId} className="text-caption text-neutral-400">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <p className="truncate text-body font-medium text-neutral-800">{children || "—"}</p>;
}
