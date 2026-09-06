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

export interface ContactFormOption {
  id: string;
  label: string;
}

/**
 * App Flow §4.4, D3 — Add Contact. "Same fields as the list columns plus
 * notes" (name, company, status, owner, employee size, city, state) plus
 * the PRD §6.1 contact fields (title, email, phone). Company fields are
 * folded in here per the client's direction (App Flow has no separate
 * Companies screen) — match_or_create_company() (Backend Schema §7.3)
 * resolves/creates the company row from name+website.
 *
 * Client-confirmed additions: First/Last Name split, Score, Temp,
 * contact-level LinkedIn, Company Phone/Address 1 — same shape as the
 * import pipeline's new fields. A matching email now updates the
 * existing contact's fields instead of blocking, matching that same
 * import behavior rather than keeping a separate rule for manual add.
 */
export function ContactForm({
  statuses,
  owners,
  defaultOwnerId,
  defaultStatusId,
}: {
  statuses: ContactFormOption[];
  owners: ContactFormOption[];
  defaultOwnerId?: string;
  defaultStatusId?: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { status_id: defaultStatusId, owner_id: defaultOwnerId },
  });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    const supabase = createClient();

    const { data: accountUser } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("account_id")
      .eq("id", accountUser.user!.id)
      .single();
    const accountId = profile!.account_id as string;

    let companyId: string | null = null;
    if (values.company_name) {
      const { data: matchedCompanyId, error: matchError } = await supabase.rpc(
        "match_or_create_company",
        {
          p_account_id: accountId,
          p_name: values.company_name,
          p_domain: values.company_website || null,
        }
      );

      if (matchError) {
        setFormError(matchError.message);
        return;
      }
      companyId = matchedCompanyId;

      if (
        values.company_website ||
        values.company_linkedin_url ||
        values.company_industry ||
        values.company_size ||
        values.company_phone ||
        values.company_address_line1 ||
        values.company_city ||
        values.company_state
      ) {
        await supabase
          .from("companies")
          .update({
            website: values.company_website || null,
            linkedin_url: values.company_linkedin_url || null,
            industry: values.company_industry || null,
            company_size: values.company_size || null,
            phone: values.company_phone || null,
            address_line1: values.company_address_line1 || null,
            city: values.company_city || null,
            state: values.company_state || null,
          })
          .eq("id", companyId);
      }
    }

    const score = values.score ? Number(values.score) : null;
    const temperature = values.temperature || null;

    // A matching email updates the existing contact instead of blocking
    // (client-confirmed, matching the import pipeline's same rule).
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", values.email)
      .is("archived_at", null)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: values.first_name,
          last_name: values.last_name || null,
          title: values.title || null,
          phone: values.phone || null,
          status_id: values.status_id,
          owner_id: values.owner_id || null,
          score,
          temperature,
          linkedin_url: values.linkedin_url || null,
          notes: values.notes || null,
          company_id: companyId ?? undefined,
        })
        .eq("id", existing.id);

      if (updateError) {
        setFormError(updateError.message);
        return;
      }

      toast.success(`${values.first_name} updated (existing contact with this email).`);
      router.push(`/contacts/${existing.id}`);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert({
        account_id: accountId,
        first_name: values.first_name,
        last_name: values.last_name || null,
        title: values.title || null,
        email: values.email,
        phone: values.phone || null,
        status_id: values.status_id,
        owner_id: values.owner_id || null,
        score,
        temperature,
        linkedin_url: values.linkedin_url || null,
        notes: values.notes || null,
        company_id: companyId,
        source: "manual",
      })
      .select("id")
      .single();

    if (error) {
      setFormError(error.message);
      return;
    }

    toast.success(`${values.first_name} added.`);
    router.push(`/contacts/${inserted.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-2xl flex-col gap-6">
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
            <Label htmlFor="linkedin_url">Person LinkedIn</Label>
            <Input id="linkedin_url" placeholder="https://linkedin.com/in/…" {...register("linkedin_url")} />
          </div>
          <div>
            <Label htmlFor="status_id" required>
              Status
            </Label>
            <Select value={watch("status_id")} onValueChange={(v) => setValue("status_id", v)}>
              <SelectTrigger id="status_id" error={!!errors.status_id}>
                <SelectValue placeholder="Select a status" />
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
        <h2 className="text-h4 text-primary-900">Company</h2>
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
            <Label htmlFor="company_linkedin_url">Company LinkedIn</Label>
            <Input id="company_linkedin_url" placeholder="https://linkedin.com/company/…" {...register("company_linkedin_url")} />
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
            <Label htmlFor="company_address_line1">Address</Label>
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

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save Contact"}
        </Button>
      </div>
    </form>
  );
}
