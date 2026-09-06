import type { Metadata } from "next";

import { ListForm } from "@/components/lists/list-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const metadata: Metadata = { title: "Create List — GrowthOS" };

export default async function NewListPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Create List</h1>
      <ListForm accountId={user.account_id!} />
    </main>
  );
}
