import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OpportunityCreateForm } from "@/components/opportunities/opportunity-create-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create Opportunity — GrowthOS" };

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ contact_id?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { contact_id } = await searchParams;
  if (!contact_id) notFound();

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("id", contact_id)
    .single();

  if (!contact) notFound();

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Create Opportunity</h1>
      <OpportunityCreateForm accountId={user.account_id!} contactId={contact.id} contactName={contact.full_name} />
    </main>
  );
}
