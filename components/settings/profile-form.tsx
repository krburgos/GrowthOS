"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Pencil, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const profileSchema = z.object({
  full_name: z.string().min(1, "Enter your name."),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

/**
 * Design System §8.9 "Profile-style content card" — icon-label-value
 * rows with an "Update Info" toggle for the editable field (Full Name);
 * Email and Role stay read-only display rows. Password change is a
 * separate card below since it has no "current value" to display.
 */
export function ProfileForm({ userId, fullName, email, roleLabel }: { userId: string; fullName: string; email: string; roleLabel: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: fullName },
  });

  const onSaveProfile = async (values: ProfileValues) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ full_name: values.full_name })
      .eq("id", userId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated.");
    setEditing(false);
    router.refresh();
  };

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (values: PasswordValues) => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    passwordForm.reset();
  };

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div id="contact-information" className="scroll-mt-6 rounded-lg border border-neutral-200 bg-white">
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

          {editing && (
            <div className="flex justify-end gap-3 px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  profileForm.reset({ full_name: fullName });
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

      <div id="password" className="scroll-mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-h4 text-primary-900">Change password</h2>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="new-password" required>
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              error={!!passwordForm.formState.errors.password}
              {...passwordForm.register("password")}
            />
            {passwordForm.formState.errors.password && (
              <p className="mt-1 text-body-sm text-error-600">
                {passwordForm.formState.errors.password.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="confirm-new-password" required>
              Confirm new password
            </Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              error={!!passwordForm.formState.errors.confirmPassword}
              {...passwordForm.register("confirmPassword")}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-body-sm text-error-600">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={passwordForm.formState.isSubmitting}
          >
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
