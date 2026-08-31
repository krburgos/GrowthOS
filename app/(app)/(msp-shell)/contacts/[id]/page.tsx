import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactOverviewForm } from "@/components/contacts/contact-overview-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact — GrowthOS" };

const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_sales", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.4, D2 — Contact Detail. Overview is fully built here;
 * Activity/Opportunities/Emails are structural placeholders until
 * Milestone 8 builds the real activity timeline and opportunity linking.
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select(
      "id, full_name, title, email, phone, status_id, owner_id, notes, company_id, companies(name, website, industry, company_size, city, state)"
    )
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!contact) notFound();

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

  type CompanyFields = {
    name: string;
    website: string | null;
    industry: string | null;
    company_size: string | null;
    city: string | null;
    state: string | null;
  };
  const companiesField = contact.companies as unknown;
  const company = (Array.isArray(companiesField) ? companiesField[0] : companiesField) as
    | CompanyFields
    | undefined;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">{contact.full_name}</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContactOverviewForm
            contactId={contact.id}
            accountId={user.account_id!}
            companyId={contact.company_id}
            canEdit={CAN_EDIT_ROLES.includes(user.role)}
            statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
            owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
            defaults={{
              full_name: contact.full_name,
              title: contact.title ?? "",
              email: contact.email,
              phone: contact.phone ?? "",
              status_id: contact.status_id,
              owner_id: contact.owner_id ?? "",
              notes: contact.notes ?? "",
              company_name: company?.name ?? "",
              company_website: company?.website ?? "",
              company_industry: company?.industry ?? "",
              company_size: company?.company_size ?? "",
              company_city: company?.city ?? "",
              company_state: company?.state ?? "",
            }}
          />
        </TabsContent>

        <TabsContent value="activity">
          <p className="text-body text-neutral-500">
            The unified activity timeline (calls, emails, meetings, tasks, notes) arrives in
            Milestone 8.
          </p>
        </TabsContent>

        <TabsContent value="opportunities">
          <p className="text-body text-neutral-500">
            Opportunities linked to this contact arrive in Milestone 8.
          </p>
        </TabsContent>

        <TabsContent value="emails">
          <p className="text-body text-neutral-500">
            Email correspondence history arrives with campaign sending in Milestone 10.
          </p>
        </TabsContent>
      </Tabs>
    </main>
  );
}
