import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateListThenUpload } from "@/components/lists/create-list-then-upload";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const metadata: Metadata = { title: "Upload List — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

export default async function UploadListPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!EDIT_ROLES.includes(user.role)) redirect("/lists");

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Upload List</h1>
      <CreateListThenUpload accountId={user.account_id!} />
    </main>
  );
}
