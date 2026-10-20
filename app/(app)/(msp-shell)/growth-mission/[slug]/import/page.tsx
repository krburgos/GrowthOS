import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderImportWizard } from "@/components/growth-mission/order-import-wizard";
import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";

export const metadata: Metadata = { title: "Import Mission Orders — GrowthMission" };

/**
 * Import Mission Orders onto one Mission Card (client-confirmed,
 * 2026-10-20, approved mockup "Import Mission Orders"). Reached from the
 * Import button on that card's Mission Orders title bar; there is no
 * import on Headquarters or the Command Center. Only the roles that can
 * issue orders get here.
 */
export default async function ImportMissionOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const step = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  if (!step || slug === ADVOCATE_DASH_SLUG) notFound();
  if (!HOURS_EDIT_ROLES.includes(user.role)) redirect(`/growth-mission/${slug}`);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <Link
        href={`/growth-mission/${slug}`}
        className="mb-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-secondary-700 hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        {step.title}
      </Link>
      <h1 className="mb-6 text-h1 text-primary-900">Import Mission Orders</h1>
      <OrderImportWizard slug={slug} cardName={step.title} />
    </main>
  );
}
