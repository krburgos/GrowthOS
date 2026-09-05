import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ImportWizard } from "@/components/contacts/import-wizard";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Upload Contacts — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * Uploads into a list's membership rather than the general Contacts
 * pool — reuses the same Import Contacts pipeline, but an existing
 * email is matched and added rather than rejected (client-confirmed,
 * see lib/import/validate.ts). Client-confirmed hybrid smart lists:
 * works for both list types now — an upload into a smart list is a
 * manual addition on top of its live criteria (Backend Schema §7.4,
 * smart_list_manual_overrides migration).
 */
export default async function UploadContactsToListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!EDIT_ROLES.includes(user.role)) redirect(`/lists/${(await params).id}`);

  const { id } = await params;
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("lists")
    .select("id, name, type")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!list) notFound();

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Upload Contacts to {list.name}</h1>
      <ImportWizard targetListId={list.id} listName={list.name} />
    </main>
  );
}
