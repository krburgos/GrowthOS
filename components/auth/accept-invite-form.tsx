"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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

export function AcceptInviteForm() {
  const router = useRouter();
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

    // App Flow §4.1, A4. Client-confirmed (2026-10-23): every newly invited
    // user lands on Headquarters, MSP Owners included. This supersedes the
    // 2026-09-15 decision to send a new Owner to the Solution Questionnaire
    // first; Headquarters' Foundations cards now point them there. "/"
    // routes to Headquarters, or to the CRO Dashboard for a CRO Leader or
    // partner who hasn't entered an account yet.
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password" required>
          Password
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
        {isSubmitting ? "Setting up…" : "Set Password & Continue"}
      </Button>
    </form>
  );
}
