import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function CroLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar fullName={user.full_name} />
      {children}
    </div>
  );
}
