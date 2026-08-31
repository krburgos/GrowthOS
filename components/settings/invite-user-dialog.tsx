"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import type { UserRole } from "@/lib/auth/get-current-user";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  full_name: z.string().min(1, "Enter a name."),
  role: z.string().min(1, "Choose a role."),
});

type Values = z.infer<typeof schema>;

export function InviteUserDialog({ inviteableRoles }: { inviteableRoles: UserRole[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();

    if (!res.ok) {
      toast.error(body.error ?? "Couldn't send the invite.");
      return;
    }

    toast.success(`Invite sent to ${values.email}.`);
    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>They&apos;ll get an email to set their password.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="invite-name" required>
              Name
            </Label>
            <Input id="invite-name" error={!!errors.full_name} {...register("full_name")} />
            {errors.full_name && (
              <p className="mt-1 text-body-sm text-error-600">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="invite-email" required>
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              error={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-body-sm text-error-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="invite-role" required>
              Role
            </Label>
            <Select value={watch("role")} onValueChange={(value) => setValue("role", value)}>
              <SelectTrigger id="invite-role" error={!!errors.role}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {inviteableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="mt-1 text-body-sm text-error-600">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
