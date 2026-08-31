import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot Password — GrowthOS" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-h3 text-primary-900">Reset your password</h1>
      <ForgotPasswordForm />
    </>
  );
}
