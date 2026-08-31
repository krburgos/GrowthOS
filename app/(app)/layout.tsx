import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUser } from "@/lib/auth/get-current-user";

/**
 * Auth guard for every authenticated screen, plus a bare-bones top bar
 * (nav links + log out) so the auth flow is testable end-to-end. The
 * real sidebar/top bar shell (App Flow §2, Design System §8.9-§8.10) is
 * Milestone 5.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <nav className="flex items-center gap-4 text-body-sm">
          <Link href="/dashboard" className="text-neutral-600 hover:text-primary-700">
            Dashboard
          </Link>
          <Link href="/settings/users" className="text-neutral-600 hover:text-primary-700">
            Users & Roles
          </Link>
          <Link href="/settings/profile" className="text-neutral-600 hover:text-primary-700">
            My Profile
          </Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
