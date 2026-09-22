"use client";

import { useRouter } from "next/navigation";

import { InlineField } from "@/components/settings/inline-field";
import { createClient } from "@/lib/supabase/client";

interface ProfileFormProps {
  userId: string;
  fullName: string;
  email: string;
  roleLabel: string;
  phone: string;
  jobTitle: string;
  linkedinUrl: string;
}

/**
 * My Profile — client-confirmed redesign (2026-09-22, approved mockup "B"):
 * each field edits on its own instead of the whole card flipping into a
 * form behind an "Update Info" button, so correcting one phone number is a
 * click, a type and Enter.
 *
 * Two problems this addresses, both raised with the design:
 *
 * - The old layout led every row with a coloured square that alternated
 *   navy, teal, navy, teal by row position. The colour encoded nothing, so
 *   six saturated chips were decoration stacked down the page. They are
 *   gone; the field label now does that work.
 * - Email and Role are read-only, but looked exactly like the editable
 *   fields until you pressed Update Info and found out. They now carry a
 *   lock and say where they are actually changed.
 *
 * Rows also stretched the full page width against a 128px label column,
 * leaving a short value floating in a wide empty line; the fields sit in a
 * two-column grid on a page capped at 900px (set by the page, not here).
 *
 * What did not change: which fields exist, which are writable, or the
 * prevent_self_role_escalation trigger that backs the read-only pair.
 */
export function ProfileForm({ userId, fullName, email, roleLabel, phone, jobTitle, linkedinUrl }: ProfileFormProps) {
  const router = useRouter();

  const save = (column: "full_name" | "phone" | "job_title" | "linkedin_url") => async (next: string) => {
    const supabase = createClient();
    // Every column here but full_name is nullable; an emptied field should
    // read as "not set" rather than as an empty string.
    const value = column === "full_name" ? next : next || null;
    const { error } = await supabase.from("users").update({ [column]: value }).eq("id", userId);
    if (!error) router.refresh();
    return { error };
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-6 py-4">
          <h2 className="text-h4 text-primary-900">Contact information</h2>
          <p className="text-caption text-neutral-400">Click any value to edit</p>
        </div>
        <div className="grid grid-cols-1 gap-x-8 px-6 py-3 sm:grid-cols-2">
          <InlineField label="Full name" value={fullName} placeholder="Add your name" onSave={save("full_name")} />
          <InlineField label="Job title" value={jobTitle} placeholder="Add a job title" onSave={save("job_title")} />
          <InlineField label="Phone" value={phone} type="tel" placeholder="Add a phone number" onSave={save("phone")} />
          <InlineField
            label="LinkedIn"
            value={linkedinUrl}
            type="url"
            href={linkedinUrl || undefined}
            placeholder="Add a LinkedIn URL"
            onSave={save("linkedin_url")}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-6 py-4">
          <h2 className="text-h4 text-primary-900">Account access</h2>
          <p className="text-caption text-neutral-400">Changed in Settings › Users &amp; Roles</p>
        </div>
        <div className="grid grid-cols-1 gap-x-8 px-6 py-3 sm:grid-cols-2">
          <InlineField label="Email" value={email} readOnly readOnlyNote="Your sign-in address cannot be changed here." />
          <InlineField
            label="Role"
            value={roleLabel}
            readOnly
            readOnlyNote="Roles are set by an Owner or Admin in Users & Roles."
          />
        </div>
      </section>
    </div>
  );
}
