import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";

/**
 * Auth guard for every authenticated screen. The visual shell itself is
 * split further down: (msp-shell) gets the real sidebar/top bar (Design
 * System §8.9-§8.10), while /cro gets its own lightweight header per App
 * Flow §4.10 ("kept intentionally light").
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="flex flex-1 flex-col">{children}</div>;
}
