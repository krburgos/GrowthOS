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
import { OPPORTUNITY_STAGES, STAGE_LABELS } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().optional(),
  stage: z.string(),
  value: z.string().optional(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function OpportunityOverviewForm({
  opportunityId,
  canEdit,
  defaults,
}: {
  opportunityId: string;
  canEdit: boolean;
  defaults: Values;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = async (values: Values) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("opportunities")
      .update({
        name: values.name || null,
        stage: values.stage,
        value: values.value ? Number(values.value) : null,
        notes: values.notes || null,
        closed_at: values.stage === "closed_won" || values.stage === "closed_lost" ? new Date().toISOString() : null,
      })
      .eq("id", opportunityId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    toast.success("Saved.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-xl flex-col gap-4">
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="opp-name">Name (optional)</Label>
          <Input id="opp-name" {...register("name")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="opp-stage" required>
              Stage
            </Label>
            <Select value={watch("stage")} onValueChange={(v) => setValue("stage", v)}>
              <SelectTrigger id="opp-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="opp-value">Value</Label>
            <Input id="opp-value" type="number" step="0.01" {...register("value")} />
          </div>
        </div>
        <div>
          <Label htmlFor="opp-notes">Notes</Label>
          <Textarea id="opp-notes" {...register("notes")} />
        </div>

        {error && <p className="text-body-sm text-error-600">{error}</p>}

        {canEdit && (
          <div>
            <Button type="submit" disabled={isSubmitting}>
              Save Changes
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
