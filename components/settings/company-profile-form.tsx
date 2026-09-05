"use client";

import { Briefcase, Building2, Globe, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface Values {
  name: string;
  website: string;
  industry: string;
  address_city: string;
  address_state: string;
}

/**
 * Design System §8.9 "Profile-style content card" — icon-label-value
 * rows with an "Update Info" toggle, replacing the previous always-
 * editable inline form. Client-confirmed gap-fill (App Flow §4.9 never
 * listed a Company Profile screen even though Backend Schema §2 already
 * grants Owner/Admin edit rights on "Accounts (own account settings)").
 * The logo itself is uploaded from the banner above (CompanyLogoUpload),
 * not edited as a field here.
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
        industry: values.industry || null,
        address_city: values.address_city || null,
        address_state: values.address_state || null,
      })
      .eq("id", accountId);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Company profile updated.");
    setEditing(false);
    router.refresh();
  };

  const location = [values.address_city, values.address_state].filter(Boolean).join(", ");

  const rows: { icon: typeof Building2; label: string; field: keyof Values; value: string; isCity?: boolean }[] = [
    { icon: Building2, label: "Company Name", field: "name", value: values.name },
    { icon: Globe, label: "Website", field: "website", value: values.website },
    { icon: Briefcase, label: "Industry", field: "industry", value: values.industry },
  ];

  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <h2 className="text-h4 text-primary-900">Company Profile</h2>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Update Info
          </Button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-neutral-100">
        {rows.map((row) => (
          <div key={row.field} className="flex items-center gap-4 px-6 py-4">
            <row.icon className="size-5 shrink-0 text-neutral-500" />
            <span className="w-32 shrink-0 text-body text-neutral-800">{row.label}</span>
            {editing ? (
              <Input value={row.value} onChange={set(row.field)} className="flex-1" />
            ) : row.field === "website" && row.value ? (
              <a href={row.value} target="_blank" rel="noreferrer" className="flex-1 text-body text-primary-700 hover:underline">
                {row.value}
              </a>
            ) : (
              <span className="flex-1 text-body text-neutral-600">{row.value || "—"}</span>
            )}
          </div>
        ))}

        <div className="flex items-center gap-4 px-6 py-4">
          <MapPin className="size-5 shrink-0 text-neutral-500" />
          <span className="w-32 shrink-0 text-body text-neutral-800">Location</span>
          {editing ? (
            <div className="flex flex-1 gap-2">
              <Input value={values.address_city} onChange={set("address_city")} placeholder="City" className="flex-1" />
              <Input value={values.address_state} onChange={set("address_state")} placeholder="State" className="flex-1" />
            </div>
          ) : (
            <span className="flex-1 text-body text-neutral-600">{location || "—"}</span>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-4">
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
