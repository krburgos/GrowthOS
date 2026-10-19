import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot Password — GrowthMission" };

/** The heading lives in the form, since it changes to "Check your email" after Send. */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
