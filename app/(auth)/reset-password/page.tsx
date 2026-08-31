import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset Password — GrowthOS" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // App Flow §4.1, A3: an expired/already-used token shows an inline
  // error with a link back to Forgot Password, not a broken form.
  if (!user) {
    return (
      <>
        <h1 className="mb-4 text-h3 text-primary-900">Link expired</h1>
        <p className="mb-4 text-body text-neutral-600">
          This password reset link has expired or was already used.
        </p>
        <Link href="/forgot-password" className="text-body text-primary-700 hover:underline">
          Request a new reset link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-h3 text-primary-900">Set a new password</h1>
      <ResetPasswordForm />
    </>
  );
}
