"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setFormError(error.message);
      return;
    }

    // Per App Flow §5.8, resetting a password lands back at Log In, not
    // straight into the dashboard.
    //
    // Client-reported fix (2026-10-19): the page sat for ~10s after Save.
    // A global sign-out waits on a network call and the browser client's
    // auth lock, with no feedback meanwhile. Clearing this browser's
    // session is all Log In needs (Supabase already ends other sessions
    // when the password changes), and a full page load guarantees the
    // move instead of relying on a client-side push from an auth page.
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login?reset=1");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password" required>
          New password
        </Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          error={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-body-sm text-error-600">{errors.password.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirm password
        </Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          error={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-body-sm text-error-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      {formError && <p className="text-body-sm text-error-600">{formError}</p>}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Saving…" : "Set New Password"}
      </Button>
    </form>
  );
}
