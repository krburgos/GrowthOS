"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MergeCompanyDialog } from "@/components/contacts/merge-company-dialog";
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
  company_industry: z.string().optional(),
  company_size: z.string().optional(),
  company_phone: z.string().optional(),
  company_address_line1: z.string().optional(),
  company_city: z.string().optional(),
  company_state: z.string().optional(),
});

type Values = z.infer<typeof schema>;

/**
 * Client-confirmed additions: First/Last Name split, Score, Temp,
 * contact-level LinkedIn, Company Phone/Address 1 — same shape as
 * ContactForm and the import pipeline. Editing an existing contact's
 * email into collision with a *different* existing contact still
 * blocks (unlike import/add) — that's reconciling two already-
 * established records' activities/opportunities, a bigger operation
 * than the "update this row's fields on a matching email" rule scoped
 * to import/create.
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
  statuses: import("@/components/contacts/contact-form").ContactFormOption[];
  owners: import("@/components/contacts/contact-form").ContactFormOption[];
  defaults: Values & { email: string };
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    const supabase = createClient();

    if (values.email.toLowerCase() !== defaults.email.toLowerCase()) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, full_name")
        .ilike("email", values.email)
        .neq("id", contactId)
        .is("archived_at", null)
        .maybeSingle();

      if (existing) {
        setFormError(`A contact with this email already exists: ${existing.full_name}.`);
        return;
      }
    }

    let nextCompanyId = companyId;
    if (values.company_name) {
      if (!nextCompanyId) {
        const { data: matchedCompanyId, error: matchError } = await supabase.rpc(
          "match_or_create_company",
          { p_account_id: accountId, p_name: values.company_name, p_domain: values.company_website || null }
        );
        if (matchError) {
          setFormError(matchError.message);
          return;
        }
        nextCompanyId = matchedCompanyId;
      } else {
        await supabase
          .from("companies")
          .update({
            name: values.company_name,
            website: values.company_website || null,
            industry: values.company_industry || null,
            company_size: values.company_size || null,
            phone: values.company_phone || null,
            address_line1: values.company_address_line1 || null,
            city: values.company_city || null,
            state: values.company_state || null,
          })
          .eq("id", nextCompanyId);
      }
    }

    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: values.first_name,
        last_name: values.last_name || null,
        title: values.title || null,
        email: values.email,
        phone: values.phone || null,
        status_id: values.status_id,
        owner_id: values.owner_id || null,
        score: values.score ? Number(values.score) : null,
        temperature: values.temperature || null,
        linkedin_url: values.linkedin_url || null,
        notes: values.notes || null,
        company_id: nextCompanyId,
      })
      .eq("id", contactId);

    if (error) {
      setFormError(
        error.code === "23505" ? "A contact with this email already exists." : error.message
      );
      return;
    }

    toast.success("Saved.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-2xl flex-col gap-6">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-h4 text-primary-900">Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name" required>
                First name
              </Label>
              <Input id="first_name" error={!!errors.first_name} {...register("first_name")} />
              {errors.first_name && (
                <p className="mt-1 text-body-sm text-error-600">{errors.first_name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} />
            </div>
            <div>
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input id="email" type="email" error={!!errors.email} {...register("email")} />
              {errors.email && <p className="mt-1 text-body-sm text-error-600">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Mobile phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div>
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input id="linkedin_url" placeholder="https://linkedin.com/in/…" {...register("linkedin_url")} />
            </div>
            <div>
              <Label htmlFor="status_id" required>
                Status
              </Label>
              <Select value={watch("status_id")} onValueChange={(v) => setValue("status_id", v)}>
                <SelectTrigger id="status_id" error={!!errors.status_id}>
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
            </div>
            <div>
              <Label htmlFor="owner_id">Owner</Label>
              <Select value={watch("owner_id")} onValueChange={(v) => setValue("owner_id", v)}>
                <SelectTrigger id="owner_id">
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
            </div>
            <div>
              <Label htmlFor="score">Score</Label>
              <Input id="score" type="number" {...register("score")} />
            </div>
            <div>
              <Label htmlFor="temperature">Temp</Label>
              <Select value={watch("temperature")} onValueChange={(v) => setValue("temperature", v)}>
                <SelectTrigger id="temperature">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 text-primary-900">Company</h2>
            {canEdit && companyId && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMergeOpen(true)}>
                Merge with another company
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" {...register("company_name")} />
            </div>
            <div>
              <Label htmlFor="company_website">Website</Label>
              <Input id="company_website" {...register("company_website")} />
            </div>
            <div>
              <Label htmlFor="company_industry">Industry</Label>
              <Input id="company_industry" {...register("company_industry")} />
            </div>
            <div>
              <Label htmlFor="company_size">Employee size</Label>
              <Input id="company_size" {...register("company_size")} />
            </div>
            <div>
              <Label htmlFor="company_phone">Company phone</Label>
              <Input id="company_phone" {...register("company_phone")} />
            </div>
            <div>
              <Label htmlFor="company_address_line1">Address 1</Label>
              <Input id="company_address_line1" {...register("company_address_line1")} />
            </div>
            <div>
              <Label htmlFor="company_city">City</Label>
              <Input id="company_city" {...register("company_city")} />
            </div>
            <div>
              <Label htmlFor="company_state">State</Label>
              <Input id="company_state" {...register("company_state")} />
            </div>
          </div>
        </section>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" {...register("notes")} />
        </div>

        {formError && <p className="text-body-sm text-error-600">{formError}</p>}

        {canEdit && (
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </fieldset>

      {companyId && (
        <MergeCompanyDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          sourceCompanyId={companyId}
          sourceCompanyName={defaults.company_name || "this company"}
          accountId={accountId}
        />
      )}
    </form>
  );
}
