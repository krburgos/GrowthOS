import type { Metadata } from "next";

import { ContactForm } from "@/components/contacts/contact-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add Contact — GrowthOS" };

export default async function NewContactPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: statuses }, { data: owners }] = await Promise.all([
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
  ]);

  const defaultStatus = statuses?.[0];

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Add Contact</h1>
      <ContactForm
        statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
        owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
        defaultOwnerId={user.id}
        defaultStatusId={defaultStatus?.id}
      />
    </main>
  );
}
