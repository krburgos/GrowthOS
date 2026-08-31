import type { Metadata } from "next";

import { ListForm } from "@/components/lists/list-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create List — GrowthOS" };

export default async function NewListPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: statuses }, { data: owners }, { data: companies }] = await Promise.all([
    supabase
      .from("contact_statuses")
      .select("id, name")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("companies")
      .select("id, name")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("name")
      .limit(200),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Create List</h1>
      <ListForm
        accountId={user.account_id!}
        statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
        owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
        companies={(companies ?? []).map((c) => ({ id: c.id, label: c.name }))}
      />
    </main>
  );
}
