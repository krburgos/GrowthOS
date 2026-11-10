"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, GitMerge, Globe, Link2, MapPin, Phone, Tag, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { MergeCompanyDialog } from "@/components/contacts/merge-company-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

export type CompanyOverviewValues = z.infer<typeof schema>;

/**
 * Company Detail's Overview card — client-confirmed refresh (2026-10-14,
 * approved mockup "Company Detail Refresh"): the same navy-headed card and
 * field rows as Contact Detail's Overview, two per row from `md` up. The
 * hero (logo, name, actions) moved to CompanyDetailBody's HeroBand, so
 * `editing` is lifted there: the hero's Edit button and this card's own
 * both open the form. Merge sits in the card header while editing.
 *
 * Previously "Concept B — Gradient hero, single scroll" (2026-09-08),
 * which carried the logo and name in this form's own gradient header.
 *
 * Client-confirmed (2026-11-10, approved mockup "Delete Company Mockup"):
 * Owner, Admin and CRO Admin get a red Delete at the far left of the edit
 * footer. A company that still has contacts or opportunities can't be
 * deleted (greyed out; hovering says why). Delete archives it through
 * archive_companies(); it comes back if a contact from it is added again.
 */
export function CompanyOverviewForm({
  companyId,
  accountId,
  canEdit,
  defaults,
  editing,
  onEditingChange,
  canDelete = false,
  contactCount = 0,
  opportunityCount = 0,
}: {
  companyId: string;
  accountId: string;
  canEdit: boolean;
  defaults: CompanyOverviewValues;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  canDelete?: boolean;
  contactCount?: number;
  opportunityCount?: number;
}) {
  const router = useRouter();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    const { data, error } = await createClient().rpc("archive_companies", { p_ids: [companyId] });
    setDeleting(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    if ((data as { deleted: number } | null)?.deleted !== 1) {
      toast.error("This company still has contacts or opportunities, so it wasn't deleted.");
      setConfirmingDelete(false);
      router.refresh();
      return;
    }
    toast.success(`${defaults.name} deleted.`);
    router.push("/companies");
  };
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyOverviewValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const values = watch();

  const handleCancel = () => {
    reset(defaults);
    onEditingChange(false);
  };

  const onSubmit = async (formValues: CompanyOverviewValues) => {
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
    onEditingChange(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 rounded-t-lg bg-primary-900 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-white">
          <Building2 className="size-4 text-secondary-300" />
          Company
        </h2>
        {canEdit &&
          (editing ? (
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-caption font-semibold text-white hover:bg-white/20"
            >
              <GitMerge className="size-3.5" />
              Merge
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              className="text-caption font-semibold text-secondary-300 hover:underline"
            >
              Edit
            </button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col divide-y divide-neutral-100 md:border-r md:border-neutral-100">
          <Row icon={Building2} label="Company Name" fieldId="name">
            {editing ? (
              <div className="flex-1">
                <Input id="name" error={!!errors.name} {...register("name")} />
                {errors.name && <p className="mt-1 text-body-sm text-error-600">{errors.name.message}</p>}
              </div>
            ) : (
              <Value>{values.name}</Value>
            )}
          </Row>
          <Row icon={Globe} label="Website" fieldId="website">
            {editing ? (
              <Input id="website" {...register("website")} className="flex-1" />
            ) : values.website ? (
              <ExternalValue href={values.website} />
            ) : (
              <Value />
            )}
          </Row>
          <Row icon={Link2} label="Company LinkedIn" fieldId="linkedin_url">
            {editing ? (
              <Input
                id="linkedin_url"
                placeholder="https://linkedin.com/company/…"
                {...register("linkedin_url")}
                className="flex-1"
              />
            ) : values.linkedin_url ? (
              <ExternalValue href={values.linkedin_url} />
            ) : (
              <Value />
            )}
          </Row>
          <Row icon={Tag} label="Industry" fieldId="industry">
            {editing ? <Input id="industry" {...register("industry")} className="flex-1" /> : <Value>{values.industry}</Value>}
          </Row>
        </div>
        <div className="flex flex-col divide-y divide-neutral-100 border-t border-neutral-100 md:border-t-0">
          <Row icon={Users} label="Employees" fieldId="company_size">
            {editing ? (
              <Input id="company_size" {...register("company_size")} className="flex-1" />
            ) : (
              <Value>{values.company_size}</Value>
            )}
          </Row>
          <Row icon={Phone} label="Phone" fieldId="phone">
            {editing ? <Input id="phone" {...register("phone")} className="flex-1" /> : <Value>{values.phone}</Value>}
          </Row>
          <Row icon={MapPin} label="Address" fieldId="address_line1">
            {editing ? (
              <Input id="address_line1" {...register("address_line1")} className="flex-1" />
            ) : (
              <Value>{values.address_line1}</Value>
            )}
          </Row>
          <Row icon={MapPin} label="City / State" fieldId="city">
            {editing ? (
              <div className="flex flex-1 gap-2">
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
        <div className="flex flex-wrap items-center gap-3 rounded-b-lg border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          {canDelete && (
            <DeleteButton
              contacts={contactCount}
              opportunities={opportunityCount}
              disabled={isSubmitting}
              onClick={() => setConfirmingDelete(true)}
            />
          )}
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}

      {confirmingDelete && (
        <Dialog open onOpenChange={(o) => !o && !deleting && setConfirmingDelete(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this company?</DialogTitle>
              <DialogDescription className="text-body text-neutral-700">
                <b className="font-semibold">{defaults.name}</b> will be removed from Companies, search and every total.
                It&apos;s kept on record: if a contact from this company is added or imported later, the company comes back
                with its earlier details.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete company"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

/** Red, at the far left of the edit footer, away from Save. Greyed out while the company has contacts or opportunities; hovering says why. */
function DeleteButton({
  contacts,
  opportunities,
  disabled,
  onClick,
}: {
  contacts: number;
  opportunities: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const blocked = contacts > 0 || opportunities > 0;
  const button = (
    <button
      type="button"
      onClick={blocked ? undefined : onClick}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-button text-error-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
        blocked ? "cursor-not-allowed opacity-40" : "hover:bg-error-50 disabled:opacity-40"
      )}
    >
      <Trash2 className="size-4" />
      Delete
    </button>
  );
  if (!blocked) return button;
  const parts = [
    contacts > 0 ? `${contacts} ${contacts === 1 ? "contact" : "contacts"}` : "",
    opportunities > 0 ? `${opportunities} ${opportunities === 1 ? "opportunity" : "opportunities"}` : "",
  ].filter(Boolean);
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="max-w-64 font-medium">
        Delete or move its {parts.join(" and ")} first. Then this company can be deleted.
      </TooltipContent>
    </Tooltip>
  );
}

function Row({
  icon: Icon,
  label,
  fieldId,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  fieldId: string;
  children: ReactNode;
}) {
  // Same row as Contact Detail's Overview: the label sits above the value on a phone.
  return (
    <div className="flex min-h-12 items-start gap-3 px-4 py-3 sm:items-center">
      <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400 sm:mt-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={fieldId} className="shrink-0 text-body-sm text-neutral-500 sm:w-32">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <span className="min-w-0 flex-1 break-words text-body text-neutral-800 sm:truncate">{children || "—"}</span>;
}

function ExternalValue({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="min-w-0 flex-1 break-all text-body font-medium text-primary-600 hover:underline sm:truncate"
    >
      {href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
    </a>
  );
}
