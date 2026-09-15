import { CroHeader } from "@/components/cro/cro-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function CroLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <CroHeader fullName={user.full_name} role={user.role} />
      {children}
    </div>
  );
}
