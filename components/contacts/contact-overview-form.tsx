"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Briefcase,
  Building2,
  Globe,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
  Tag,
  Thermometer,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MergeCompanyDialog } from "@/components/contacts/merge-company-dialog";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  first_name: z.string().min(1, "Enter a first name."),
  last_name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().optional(),
  status_id: z.string().min(1, "Choose a status."),
  owner_id: z.string().optional(),
  score: z.string().optional(),
  temperature: z.string().optional(),
  linkedin_url: z.string().optional(),
  notes: z.string().optional(),
  company_name: z.string().optional(),
  company_website: z.string().optional(),
  company_linkedin_url: z.string().optional(),
  company_industry: z.string().optional(),
  company_size: z.string().optional(),
  company_phone: z.string().optional(),
  company_address_line1: z.string().optional(),
  company_city: z.string().optional(),
  company_state: z.string().optional(),
});

type Values = z.infer<typeof schema>;
export type ContactOverviewDefaults = Values & { email: string };

type Option = { id: string; label: string };

/**
 * Client-confirmed additions: First/Last Name split, Score, Temp,
 * contact-level LinkedIn, Company Phone/Address 1 — same shape as
 * ContactForm and the import pipeline. Editing an existing contact's
 * email into collision with a *different* existing contact still
 * blocks (unlike import/add) — that's reconciling two already-
 * established records' activities/opportunities, a bigger operation
 * than the "update this row's fields on a matching email" rule scoped
 * to import/create.
 *
 * Client-confirmed modernization pass (approved mockup, Contact Detail
 * redesign): replaces the always-editable form with the same
 * view/edit toggle already used on Company Profile (§8.9) — read-only
 * icon-label-value rows, grouped into a Contact card and a Company
 * card, with an Edit button that reveals inputs plus Save/Cancel. An
 * Impeccable critique had flagged the always-editable version as a
 * User-Control-and-Freedom gap (no Cancel, no signal about whether you
 * were viewing or editing); this closes it using the pattern the app
 * already established elsewhere rather than inventing a new one.
 */
export function ContactOverviewForm({
  contactId,
  accountId,
  companyId,
  canEdit,
  statuses,
  owners,
  defaults,
}: {
  contactId: string;
  accountId: string;
  companyId: string | null;
  canEdit: boolean;
  statuses: Option[];
  owners: Option[];
  defaults: ContactOverviewDefaults;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const values = watch();

  const handleEdit = () => setEditing(true);
  const handleCancel = () => {
    reset(defaults);
    setFormError(null);
    setEditing(false);
  };

  const onSubmit = async (formValues: Values) => {
    setFormError(null);
    const supabase = createClient();

    if (formValues.email.toLowerCase() !== defaults.email.toLowerCase()) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, full_name")
        .ilike("email", formValues.email)
        .neq("id", contactId)
        .is("archived_at", null)
        .maybeSingle();

      if (existing) {
        setFormError(`A contact with this email already exists: ${existing.full_name}.`);
        return;
      }
    }

    let nextCompanyId = companyId;
    if (formValues.company_name) {
      if (!nextCompanyId) {
        const { data: matchedCompanyId, error: matchError } = await supabase.rpc(
          "match_or_create_company",
          { p_account_id: accountId, p_name: formValues.company_name, p_domain: formValues.company_website || null }
        );
        if (matchError) {
          setFormError(getFriendlyErrorMessage(matchError));
          return;
        }
        nextCompanyId = matchedCompanyId;
      } else {
        await supabase
          .from("companies")
          .update({
            name: formValues.company_name,
            website: formValues.company_website || null,
            linkedin_url: formValues.company_linkedin_url || null,
            industry: formValues.company_industry || null,
            company_size: formValues.company_size || null,
            phone: formValues.company_phone || null,
            address_line1: formValues.company_address_line1 || null,
            city: formValues.company_city || null,
            state: formValues.company_state || null,
          })
          .eq("id", nextCompanyId);
      }
    }

    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: formValues.first_name,
        last_name: formValues.last_name || null,
        title: formValues.title || null,
        email: formValues.email,
        phone: formValues.phone || null,
        status_id: formValues.status_id,
        owner_id: formValues.owner_id || null,
        score: formValues.score ? Number(formValues.score) : null,
        temperature: formValues.temperature || null,
        linkedin_url: formValues.linkedin_url || null,
        notes: formValues.notes || null,
        company_id: nextCompanyId,
      })
      .eq("id", contactId);

    if (error) {
      setFormError(
        error.code === "23505" ? "A contact with this email already exists." : getFriendlyErrorMessage(error)
      );
      return;
    }

    toast.success("Saved.");
    setEditing(false);
    router.refresh();
  };

  const statusLabel = statuses.find((s) => s.id === values.status_id)?.label;
  const ownerLabel = owners.find((o) => o.id === values.owner_id)?.label;
  const tempLabel = values.temperature === "hot" ? "Hot" : values.temperature === "cold" ? "Cold" : undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-3xl flex-col gap-5">
      {canEdit && (
        <div className="flex justify-end">
          {!editing ? (
            <Button type="button" variant="secondary" size="sm" onClick={handleEdit}>
              <Pencil className="mr-1.5 size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-caption font-semibold uppercase tracking-wide text-neutral-500">
            Contact
          </h2>
          <div className="flex flex-col divide-y divide-neutral-100">
            <Row icon={Mail} label="Email" fieldId="email">
              {editing ? (
                <>
                  <Input id="email" type="email" error={!!errors.email} {...register("email")} className="flex-1" />
                  {errors.email && <p className="mt-1 text-body-sm text-error-600">{errors.email.message}</p>}
                </>
              ) : (
                <Value>{values.email}</Value>
              )}
            </Row>
            <Row icon={Phone} label="Mobile Phone" fieldId="phone">
              {editing ? <Input id="phone" {...register("phone")} className="flex-1" /> : <Value>{values.phone}</Value>}
            </Row>
            <Row icon={Briefcase} label="Title" fieldId="title">
              {editing ? <Input id="title" {...register("title")} className="flex-1" /> : <Value>{values.title}</Value>}
            </Row>
            <Row icon={Tag} label="Status" fieldId="status_id">
              {editing ? (
                <Select value={watch("status_id")} onValueChange={(v) => setValue("status_id", v)}>
                  <SelectTrigger id="status_id" error={!!errors.status_id} className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Value>{statusLabel}</Value>
              )}
            </Row>
            <Row icon={User} label="Owner" fieldId="owner_id">
              {editing ? (
                <Select value={watch("owner_id")} onValueChange={(v) => setValue("owner_id", v)}>
                  <SelectTrigger id="owner_id" className="flex-1">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Value>{ownerLabel}</Value>
              )}
            </Row>
            <Row icon={Star} label="Score" fieldId="score">
              {editing ? (
                <Input id="score" type="number" {...register("score")} className="flex-1" />
              ) : (
                <Value>{values.score}</Value>
              )}
            </Row>
            <Row icon={Thermometer} label="Temp" fieldId="temperature">
              {editing ? (
                <Select value={watch("temperature")} onValueChange={(v) => setValue("temperature", v)}>
                  <SelectTrigger id="temperature" className="flex-1">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Value>{tempLabel}</Value>
              )}
            </Row>
            <Row icon={Link2} label="LinkedIn" fieldId="linkedin_url">
              {editing ? (
                <Input id="linkedin_url" placeholder="https://linkedin.com/in/…" {...register("linkedin_url")} className="flex-1" />
              ) : values.linkedin_url ? (
                <a href={values.linkedin_url} target="_blank" rel="noreferrer" className="flex-1 truncate text-body text-primary-700 hover:underline">
                  {values.linkedin_url}
                </a>
              ) : (
                <Value />
              )}
            </Row>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
            <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Company</h2>
            {editing && canEdit && companyId && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMergeOpen(true)}>
                Merge with another company
              </Button>
            )}
          </div>
          <div className="flex flex-col divide-y divide-neutral-100">
            <Row icon={Building2} label="Company Name" fieldId="company_name">
              {editing ? <Input id="company_name" {...register("company_name")} className="flex-1" /> : <Value>{values.company_name}</Value>}
            </Row>
            <Row icon={Globe} label="Website" fieldId="company_website">
              {editing ? (
                <Input id="company_website" {...register("company_website")} className="flex-1" />
              ) : values.company_website ? (
                <a href={values.company_website} target="_blank" rel="noreferrer" className="flex-1 truncate text-body text-primary-700 hover:underline">
                  {values.company_website}
                </a>
              ) : (
                <Value />
              )}
            </Row>
            <Row icon={Link2} label="Company LinkedIn" fieldId="company_linkedin_url">
              {editing ? (
                <Input
                  id="company_linkedin_url"
                  placeholder="https://linkedin.com/company/…"
                  {...register("company_linkedin_url")}
                  className="flex-1"
                />
              ) : values.company_linkedin_url ? (
                <a
                  href={values.company_linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-body text-primary-700 hover:underline"
                >
                  {values.company_linkedin_url}
                </a>
              ) : (
                <Value />
              )}
            </Row>
            <Row icon={Tag} label="Industry" fieldId="company_industry">
              {editing ? (
                <Input id="company_industry" {...register("company_industry")} className="flex-1" />
              ) : (
                <Value>{values.company_industry}</Value>
              )}
            </Row>
            <Row icon={Users} label="Employees" fieldId="company_size">
              {editing ? <Input id="company_size" {...register("company_size")} className="flex-1" /> : <Value>{values.company_size}</Value>}
            </Row>
            <Row icon={Phone} label="Company Phone" fieldId="company_phone">
              {editing ? (
                <Input id="company_phone" {...register("company_phone")} className="flex-1" />
              ) : (
                <Value>{values.company_phone}</Value>
              )}
            </Row>
            <Row icon={MapPin} label="Address 1" fieldId="company_address_line1">
              {editing ? (
                <Input id="company_address_line1" {...register("company_address_line1")} className="flex-1" />
              ) : (
                <Value>{values.company_address_line1}</Value>
              )}
            </Row>
            <Row icon={MapPin} label="City" fieldId="company_city">
              {editing ? <Input id="company_city" {...register("company_city")} className="flex-1" /> : <Value>{values.company_city}</Value>}
            </Row>
            <Row icon={MapPin} label="State" fieldId="company_state">
              {editing ? <Input id="company_state" {...register("company_state")} className="flex-1" /> : <Value>{values.company_state}</Value>}
            </Row>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <label htmlFor="notes" className="mb-2 block text-caption font-semibold uppercase tracking-wide text-neutral-500">
          Notes
        </label>
        {editing ? (
          <Textarea id="notes" {...register("notes")} />
        ) : (
          <p className="whitespace-pre-wrap text-body text-neutral-700">{values.notes || "—"}</p>
        )}
      </div>

      {formError && <p className="text-body-sm text-error-600">{formError}</p>}

      {editing && (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}

      {companyId && (
        <MergeCompanyDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          sourceCompanyId={companyId}
          sourceCompanyName={values.company_name || "this company"}
          accountId={accountId}
        />
      )}
    </form>
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
  /** Associates the label with the field's input/select in edit mode
   * (react-hook-form's `register` doesn't set `id` on its own, and the
   * view-mode `<Value>` has no control to point at — a `label` with no
   * matching `id` is harmless, so one `htmlFor` covers both states). */
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-neutral-400" />
      <label htmlFor={fieldId} className="w-28 shrink-0 text-body-sm text-neutral-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Value({ children }: { children?: ReactNode }) {
  return <span className="flex-1 truncate text-body text-neutral-800">{children || "—"}</span>;
}
