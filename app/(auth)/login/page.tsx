import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log In — GrowthOS" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-h3 text-primary-900">Log in to GrowthOS</h1>
      <LoginForm />
    </>
  );
}
