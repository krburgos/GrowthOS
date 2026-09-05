"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

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
 * Its own Settings destination (/settings/profile/password), separate
 * from Contact Information — not a second card stacked on the same
 * page. Has no "current value" to display, so it skips the icon-label
 * row / Update Info pattern used elsewhere in the profile-style card.
 */
export function PasswordForm() {
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
    <div className="max-w-xl rounded-lg border border-neutral-200 bg-white p-6">
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
  );
}
