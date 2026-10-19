"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type Values = z.infer<typeof schema>;

/** Seconds between reset emails, so a second send can't overtake the first. */
const RESEND_AFTER = 60;

async function sendReset(email: string) {
  // Deliberately ignore the result — always show the same confirmation,
  // whether or not the address is registered (App Flow §4.1, A2).
  await createClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
}

/**
 * Forgot Password (A2). Client-confirmed (2026-10-19, approved mockup
 * "Sign-in Routing"): after Send, a "Check your email" screen naming the
 * address, with a spam hint, Send again after RESEND_AFTER seconds and a
 * way back to Log In, instead of a single dead-end sentence. It still never
 * says whether the address has an account.
 */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const onSubmit = async (values: Values) => {
    await sendReset(values.email);
    setSentTo(values.email);
    setWait(RESEND_AFTER);
  };

  const resend = async () => {
    if (!sentTo || wait > 0) return;
    setResending(true);
    await sendReset(sentTo);
    setResending(false);
    setWait(RESEND_AFTER);
  };

  if (sentTo) {
    const clock = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h3 text-primary-900">Check your email</h1>
        <p className="text-body text-neutral-600">
          If an account exists for <span className="font-semibold text-neutral-900">{sentTo}</span>, we&apos;ve sent a
          link to reset its password.
        </p>
        <p className="text-body-sm text-neutral-500">Not there after a few minutes? Check your spam or junk folder.</p>
        <Button type="button" variant="secondary" onClick={() => void resend()} disabled={wait > 0 || resending}>
          {resending ? "Sending…" : wait > 0 ? `Send again in ${clock}` : "Send again"}
        </Button>
        <Link href="/login" className="text-center text-body-sm text-primary-700 hover:underline">
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-h3 text-primary-900">Reset your password</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input id="email" type="email" autoComplete="email" error={!!errors.email} {...register("email")} />
          {errors.email && <p className="mt-1 text-body-sm text-error-600">{errors.email.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Sending…" : "Send Reset Link"}
        </Button>
        <Link href="/login" className="text-center text-body-sm text-primary-700 hover:underline">
          ← Back to log in
        </Link>
      </form>
    </>
  );
}
