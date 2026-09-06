"use client";

import { Building2, Globe, Link as LinkIcon, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Values {
  name: string;
  website: string;
  linkedin_url: string;
  address_city: string;
  address_state: string;
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
        <Row icon={MapPin} tone="teal" label="Location" fieldId="company_city">
          {editing ? (
            <div className="flex gap-2">
              <Input id="company_city" value={values.address_city} onChange={set("address_city")} placeholder="City" />
              <Input value={values.address_state} onChange={set("address_state")} placeholder="State" aria-label="State" />
            </div>
          ) : (
            <Value>{location}</Value>
          )}
        </Row>
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
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: "navy" | "teal";
  label: string;
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
          tone === "navy" ? "bg-primary-700" : "bg-secondary-600"
        )}
      >
        <Icon className="size-4" />
      </span>
      <label htmlFor={fieldId} className="block w-32 shrink-0 text-body text-neutral-800">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <p className="truncate text-body text-neutral-600">{children || "—"}</p>;
}
