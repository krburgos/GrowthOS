"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Enter a company name."),
  website: z.string().optional(),
  industry: z.string().optional(),
  logo_url: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/**
 * Client-confirmed gap-fill (App Flow §4.9 never listed a Company
 * Profile screen even though Backend Schema §2 already grants Owner/
 * Admin edit rights on "Accounts (own account settings)"). logo_url is
 * a link to an already-hosted image, not a file upload — Backend Schema
 * §12 keeps file attachments out of Phase 1 scope.
 */
export function CompanyProfileForm({
  accountId,
  canEdit,
  defaults,
}: {
  accountId: string;
  canEdit: boolean;
  defaults: Values;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = async (values: Values) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .update({
        name: values.name,
        website: values.website || null,
        industry: values.industry || null,
        logo_url: values.logo_url || null,
        address_city: values.address_city || null,
        address_state: values.address_state || null,
      })
      .eq("id", accountId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Company profile updated.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-md flex-col gap-4">
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="company-name" required>
            Company name
          </Label>
          <Input id="company-name" {...register("name")} />
        </div>
        <div>
          <Label htmlFor="company-website">Website</Label>
          <Input id="company-website" {...register("website")} />
        </div>
        <div>
          <Label htmlFor="company-industry">Industry</Label>
          <Input id="company-industry" {...register("industry")} />
        </div>
        <div>
          <Label htmlFor="company-logo">Logo URL</Label>
          <Input id="company-logo" placeholder="https://…" {...register("logo_url")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company-city">City</Label>
            <Input id="company-city" {...register("address_city")} />
          </div>
          <div>
            <Label htmlFor="company-state">State</Label>
            <Input id="company-state" {...register("address_state")} />
          </div>
        </div>
        {canEdit && (
          <Button type="submit" size="sm" className="self-start" disabled={isSubmitting}>
            Save
          </Button>
        )}
      </fieldset>
    </form>
  );
}
