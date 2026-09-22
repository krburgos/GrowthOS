import { redirect } from "next/navigation";

import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";

/**
 * The bare domain sends people where they belong, rather than rendering a
 * page of its own.
 *
 * This used to be the Milestone 1 checkpoint placeholder — a gallery of
 * restyled buttons, badges and inputs, built so the Design System token
 * wiring could be confirmed before any real screen existed. The
 * Implementation Plan said it would be superseded by the Dashboard in
 * Milestone 11; it was, but the file stayed, so anyone landing on the root
 * URL got the component gallery instead of the app.
 *
 * The routing mirrors the Dashboard's own: a CRO Leader or partner role that
 * has not entered an account yet belongs on /cro, everyone else signed in on
 * /dashboard, and anyone signed out on /login.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsAccountSelection(user.role) && !user.account_id) redirect("/cro");
  redirect("/dashboard");
}
