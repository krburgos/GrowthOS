"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Globe, Link2, MapPin, Pencil, Phone, Tag, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CompanyLogoUpload } from "@/components/companies/company-logo-upload";
import { MergeCompanyDialog } from "@/components/contacts/merge-company-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Enter a company name."),
  website: z.string().optional(),
  linkedin_url: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Client-confirmed redesign ("Concept B — Gradient hero, single
 * scroll", mockup review, 2026-09-08): a navy→teal glow hero (same
 * technique as Login and Settings' profile pages) replaces the plain
 * `<h1>` + card header — company logo (now uploadable, see
 * `CompanyLogoUpload`), name, and an industry/city subtitle up top,
 * with Update Info and Merge as the hero's own action buttons. Fields
 * moved from a single-column list to a 2-column grid below the hero,
 * for a denser "modernized" read without losing any field. The logo
 * circle is sized to match `ProfileHeader`'s 96px hero avatar
 * precedent (client-confirmed, "make the logo visible" — the same
 * lesson from the Login screen and My Profile passes) rather than a
 * small icon that would get lost against the gradient.
 */
export function CompanyOverviewForm({
  companyId,
  accountId,
  canEdit,
  defaults,
}: {
  companyId: string;
  accountId: string;
  canEdit: boolean;
  defaults: Values & { logo_url: string | null };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const values = watch();
  const subtitle = [values.industry, [values.city, values.state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");

  const handleCancel = () => {
    reset(defaults);
    setEditing(false);
  };

  const onSubmit = async (formValues: Values) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("companies")
      .update({
        name: formValues.name,
        website: formValues.website || null,
        linkedin_url: formValues.linkedin_url || null,
        industry: formValues.industry || null,
        company_size: formValues.company_size || null,
        phone: formValues.phone || null,
        address_line1: formValues.address_line1 || null,
        city: formValues.city || null,
        state: formValues.state || null,
      })
      .eq("id", companyId);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Company updated.");
    setEditing(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div
        className="relative overflow-hidden px-7 py-7"
        style={{
          background:
            "radial-gradient(500px circle at 88% -40%, var(--color-secondary-400) 0%, transparent 55%), linear-gradient(120deg, var(--color-primary-600), var(--color-secondary-600))",
        }}
      >
        <div className="relative z-10 flex items-center gap-5">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/70 bg-gradient-to-br from-primary-500 to-secondary-500 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]">
            <CompanyLogoUpload
              companyId={companyId}
              accountId={accountId}
              logoUrl={defaults.logo_url}
              canEdit={canEdit}
              initials={initials(values.name || "?")}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h3 text-white">{values.name}</h1>
            {subtitle && <p className="mt-0.5 truncate text-body-sm text-white/70">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {editing && canEdit && (
              <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setMergeOpen(true)}>
                Merge
              </Button>
            )}
            {canEdit && !editing && (
              <Button type="button" size="sm" onClick={() => setEditing(true)} className="bg-white text-primary-800 hover:bg-white/90">
                <Pencil className="mr-1.5 size-4" />
                Update Info
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-neutral-100 border-t border-neutral-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col divide-y divide-neutral-100">
          <Row icon={Building2} tone="navy" label="Company Name" fieldId="name">
            {editing ? (
              <>
                <Input id="name" error={!!errors.name} {...register("name")} />
                {errors.name && <p className="mt-1 text-body-sm text-error-600">{errors.name.message}</p>}
              </>
            ) : (
              <Value>{values.name}</Value>
            )}
          </Row>
          <Row icon={Globe} tone="teal" label="Website" fieldId="website">
            {editing ? (
              <Input id="website" {...register("website")} />
            ) : values.website ? (
              <a href={values.website} target="_blank" rel="noreferrer" className="block truncate text-body font-medium text-primary-700 hover:underline">
                {values.website}
              </a>
            ) : (
              <Value />
            )}
          </Row>
          <Row icon={Link2} tone="navy" label="Company LinkedIn" fieldId="linkedin_url">
            {editing ? (
              <Input id="linkedin_url" placeholder="https://linkedin.com/company/…" {...register("linkedin_url")} />
            ) : values.linkedin_url ? (
              <a href={values.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-body font-medium text-primary-700 hover:underline">
                {values.linkedin_url}
              </a>
            ) : (
              <Value />
            )}
          </Row>
          <Row icon={Tag} tone="teal" label="Industry" fieldId="industry">
            {editing ? <Input id="industry" {...register("industry")} /> : <Value>{values.industry}</Value>}
          </Row>
        </div>
        <div className="flex flex-col divide-y divide-neutral-100">
          <Row icon={Users} tone="navy" label="Employees" fieldId="company_size">
            {editing ? <Input id="company_size" {...register("company_size")} /> : <Value>{values.company_size}</Value>}
          </Row>
          <Row icon={Phone} tone="teal" label="Phone" fieldId="phone">
            {editing ? <Input id="phone" {...register("phone")} /> : <Value>{values.phone}</Value>}
          </Row>
          <Row icon={MapPin} tone="navy" label="Address" fieldId="address_line1">
            {editing ? <Input id="address_line1" {...register("address_line1")} /> : <Value>{values.address_line1}</Value>}
          </Row>
          <Row icon={MapPin} tone="teal" label="City / State" fieldId="city">
            {editing ? (
              <div className="flex gap-2">
                <Input id="city" {...register("city")} placeholder="City" />
                <Input {...register("state")} placeholder="State" aria-label="State" />
              </div>
            ) : (
              <Value>{[values.city, values.state].filter(Boolean).join(", ")}</Value>
            )}
          </Row>
        </div>
      </div>

      {editing && (
        <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      <MergeCompanyDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        sourceCompanyId={companyId}
        sourceCompanyName={values.name || "this company"}
        accountId={accountId}
      />
    </form>
  );
}

function Row({
  icon: Icon,
  tone,
  label,
  fieldId,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: "navy" | "teal";
  label: string;
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-white ${
          tone === "navy" ? "bg-primary-700" : "bg-secondary-600"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <label htmlFor={fieldId} className="block w-28 shrink-0 text-body text-neutral-800">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <p className="truncate text-body text-neutral-600">{children || "—"}</p>;
}
