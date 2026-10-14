import type { Metadata } from "next";

import { ContactForm } from "@/components/contacts/contact-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add Contact — GrowthMission" };

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ company_id?: string }> }) {
  const { company_id: companyId } = await searchParams;
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

  // Opened from Company Detail's Add Contact (client-confirmed, 2026-10-14):
  // fill in that company, so match_or_create_company() links the same row.
  const { data: company } = companyId
    ? await supabase
        .from("companies")
        .select("name, website, linkedin_url, industry, company_size, phone, address_line1, city, state")
        .eq("id", companyId)
        .eq("account_id", user.account_id)
        .is("archived_at", null)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Add Contact</h1>
      <ContactForm
        statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
        owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
        defaultOwnerId={user.id}
        defaultStatusId={defaultStatus?.id}
        defaultCompanyId={company ? companyId : undefined}
        defaultCompany={
          company
            ? {
                company_name: company.name,
                company_website: company.website ?? undefined,
                company_linkedin_url: company.linkedin_url ?? undefined,
                company_industry: company.industry ?? undefined,
                company_size: company.company_size ?? undefined,
                company_phone: company.phone ?? undefined,
                company_address_line1: company.address_line1 ?? undefined,
                company_city: company.city ?? undefined,
                company_state: company.state ?? undefined,
              }
            : undefined
        }
      />
    </main>
  );
}
