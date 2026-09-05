"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Link as LinkIcon, Mail, Pencil, Phone, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

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
 * Design System §8.9 "Profile-style content card" — icon-label-value
 * rows with an "Update Info" toggle. Full Name/Phone/Job Title/LinkedIn
 * are editable; Email and Role stay read-only (role changes go through
 * Users & Roles, not a user's own profile). Phone/Job Title/LinkedIn are
 * a client-confirmed gap-fill, same shape as Company Profile's earlier
 * additions — not the "custom fields" concept Backend Schema §12
 * excludes, just a few specific named columns. Password change lives on
 * its own page (/settings/profile/password), not stacked here — the two
 * are separate destinations in the Settings panel, not sections of one
 * scrollable page.
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
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated.");
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <h2 className="text-h4 text-primary-900">Contact Information</h2>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 size-4" />
            Update Info
          </Button>
        )}
      </div>

      <form onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate className="flex flex-col divide-y divide-neutral-100">
        <div className="flex items-center gap-4 px-6 py-4">
          <UserIcon className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">Full Name</span>
          {editing ? (
            <div className="flex-1">
              <Input
                id="full_name"
                error={!!profileForm.formState.errors.full_name}
                {...profileForm.register("full_name")}
              />
              {profileForm.formState.errors.full_name && (
                <p className="mt-1 text-body-sm text-error-600">
                  {profileForm.formState.errors.full_name.message}
                </p>
              )}
            </div>
          ) : (
            <span className="flex-1 text-body text-neutral-600">{fullName}</span>
          )}
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <Mail className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">Email</span>
          <span className="flex-1 text-body text-neutral-600">{email}</span>
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <Shield className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">Role</span>
          <span className="flex-1 text-body text-neutral-600">{roleLabel}</span>
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <Phone className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">Phone Number</span>
          {editing ? (
            <Input className="flex-1" {...profileForm.register("phone")} />
          ) : (
            <span className="flex-1 text-body text-neutral-600">{phone || "—"}</span>
          )}
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <Briefcase className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">Job Title</span>
          {editing ? (
            <Input className="flex-1" {...profileForm.register("job_title")} />
          ) : (
            <span className="flex-1 text-body text-neutral-600">{jobTitle || "—"}</span>
          )}
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <LinkIcon className="size-5 shrink-0 text-neutral-500" />
          <span className="w-24 shrink-0 text-body text-neutral-800">LinkedIn</span>
          {editing ? (
            <Input className="flex-1" placeholder="https://linkedin.com/in/…" {...profileForm.register("linkedin_url")} />
          ) : linkedinUrl ? (
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="flex-1 text-body text-primary-700 hover:underline">
              {linkedinUrl}
            </a>
          ) : (
            <span className="flex-1 text-body text-neutral-600">—</span>
          )}
        </div>

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
