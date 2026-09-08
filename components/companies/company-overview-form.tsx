"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Globe, Link2, MapPin, Pencil, Phone, Tag, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

/**
 * Client-confirmed addition (Companies page, 2026-09-08): the same
 * field set and icon-label-value row pattern already used for Contact
 * Detail's Company card (`ContactOverviewForm`), lifted into its own
 * standalone editable form now that a company has a record of its
 * own to live on — not a new design, the same one reused. "Merge with
 * another company" moves here from Contact Detail per client
 * direction; it's no longer offered from the Contact Detail Company
 * card.
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
  defaults: Values;
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
        <h2 className="text-h4 text-primary-900">Company Profile</h2>
        <div className="flex items-center gap-2">
          {editing && canEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setMergeOpen(true)}>
              Merge with another company
            </Button>
          )}
          {canEdit && !editing && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 size-4" />
              Update Info
            </Button>
          )}
        </div>
      </div>

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
        <Row icon={Users} tone="navy" label="Employees" fieldId="company_size">
          {editing ? <Input id="company_size" {...register("company_size")} /> : <Value>{values.company_size}</Value>}
        </Row>
        <Row icon={Phone} tone="teal" label="Phone" fieldId="phone">
          {editing ? <Input id="phone" {...register("phone")} /> : <Value>{values.phone}</Value>}
        </Row>
        <Row icon={MapPin} tone="navy" label="Address" fieldId="address_line1">
          {editing ? <Input id="address_line1" {...register("address_line1")} /> : <Value>{values.address_line1}</Value>}
        </Row>
        <Row icon={MapPin} tone="teal" label="City" fieldId="city">
          {editing ? <Input id="city" {...register("city")} /> : <Value>{values.city}</Value>}
        </Row>
        <Row icon={MapPin} tone="navy" label="State" fieldId="state">
          {editing ? <Input id="state" {...register("state")} /> : <Value>{values.state}</Value>}
        </Row>
      </div>

      {editing && (
        <div className="flex justify-end gap-3 px-6 py-4">
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
      <label htmlFor={fieldId} className="block w-32 shrink-0 text-body text-neutral-800">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <p className="truncate text-body text-neutral-600">{children || "—"}</p>;
}
