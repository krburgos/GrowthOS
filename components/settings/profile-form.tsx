"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Link as LinkIcon, Mail, Pencil, Phone, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  full_name: z.string().min(1, "Enter your name."),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  linkedin_url: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

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
 * Design System §8.9 "Profile-style content card," Concept A (approved
 * mockup — reverts Concept B's two-column grid back to a single-column
 * icon-label-value list, now with colored navy/teal icon badges
 * instead of flat grey, alternating per row). Full Name/Phone/Job
 * Title/LinkedIn are editable; Email and Role stay read-only (role
 * changes go through Users & Roles, not a user's own profile).
 * Password change lives on its own page (/settings/profile/password),
 * not stacked here.
 */
export function ProfileForm({ userId, fullName, email, roleLabel, phone, jobTitle, linkedinUrl }: ProfileFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: fullName, phone, job_title: jobTitle, linkedin_url: linkedinUrl },
  });

  const onSaveProfile = async (values: ProfileValues) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        job_title: values.job_title || null,
        linkedin_url: values.linkedin_url || null,
      })
      .eq("id", userId);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Profile updated.");
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
        <h2 className="text-h4 text-primary-900">Contact Information</h2>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Update Info
          </Button>
        )}
      </div>

      <form onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate className="flex flex-col divide-y divide-neutral-100">
        <Row icon={UserIcon} tone="navy" label="Full Name" fieldId="full_name">
          {editing ? (
            <>
              <Input
                id="full_name"
                error={!!profileForm.formState.errors.full_name}
                {...profileForm.register("full_name")}
              />
              {profileForm.formState.errors.full_name && (
                <p className="mt-1 text-body-sm text-error-600">{profileForm.formState.errors.full_name.message}</p>
              )}
            </>
          ) : (
            <Value>{fullName}</Value>
          )}
        </Row>
        <Row icon={Mail} tone="teal" label="Email" fieldId="email">
          <Value>{email}</Value>
        </Row>
        <Row icon={Shield} tone="navy" label="Role" fieldId="role">
          <Value>{roleLabel}</Value>
        </Row>
        <Row icon={Phone} tone="teal" label="Phone Number" fieldId="phone">
          {editing ? <Input id="phone" {...profileForm.register("phone")} /> : <Value>{phone}</Value>}
        </Row>
        <Row icon={Briefcase} tone="navy" label="Job Title" fieldId="job_title">
          {editing ? <Input id="job_title" {...profileForm.register("job_title")} /> : <Value>{jobTitle}</Value>}
        </Row>
        <Row icon={LinkIcon} tone="teal" label="LinkedIn" fieldId="linkedin_url">
          {editing ? (
            <Input id="linkedin_url" placeholder="https://linkedin.com/in/…" {...profileForm.register("linkedin_url")} />
          ) : linkedinUrl ? (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-body font-medium text-primary-700 hover:underline"
            >
              {linkedinUrl}
            </a>
          ) : (
            <Value />
          )}
        </Row>

        {editing && (
          <div className="flex justify-end gap-3 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                profileForm.reset({ full_name: fullName, phone, job_title: jobTitle, linkedin_url: linkedinUrl });
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              Save
            </Button>
          </div>
        )}
      </form>
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
  /** Associates the label with the field's input in edit mode — a
   * `label` with no matching `id` in view mode is harmless. */
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
