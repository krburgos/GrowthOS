"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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

export function ProfileForm({ userId, fullName }: { userId: string; fullName: string }) {
  const router = useRouter();

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
    <div className="flex flex-col gap-8">
      <form
        onSubmit={profileForm.handleSubmit(onSaveProfile)}
        noValidate
        className="flex max-w-sm flex-col gap-4"
      >
        <h2 className="text-h4 text-primary-900">Name</h2>
        <div>
          <Label htmlFor="full_name" required>
            Full name
          </Label>
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
        <Button type="submit" size="sm" className="self-start" disabled={profileForm.formState.isSubmitting}>
          Save
        </Button>
      </form>

      <form
        onSubmit={passwordForm.handleSubmit(onChangePassword)}
        noValidate
        className="flex max-w-sm flex-col gap-4"
      >
        <h2 className="text-h4 text-primary-900">Change password</h2>
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
  );
}
