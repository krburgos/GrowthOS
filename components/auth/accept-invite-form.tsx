"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

    // App Flow §4.1, A4: on success, straight to the Dashboard — no real
    // Onboarding Wizard exists in this codebase despite being documented
    // (App Flow's own B1 screen was never built). Client-confirmed
    // (2026-09-15): a freshly-invited Owner — the one role the Growth
    // Solution Questionnaire is actually meant for — lands on it first
    // instead, with its own "Skip for now" back to the Dashboard; every
    // other invited role goes straight to the Dashboard as before.
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const { data: profile } = authUser
      ? await supabase.from("users").select("role").eq("id", authUser.id).single()
      : { data: null };

    router.push(profile?.role === "msp_owner" ? "/settings/growth-questionnaire" : "/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          type="password"
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
        <Input
          id="confirmPassword"
          type="password"
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
