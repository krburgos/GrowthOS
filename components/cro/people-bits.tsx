"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/lib/auth/get-current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the CRO Leader dashboard's people sections
 * (client-confirmed, 2026-10-22, approved mockup "CRO Dashboard People"):
 * CRO Leader Team and All Users. Both invite through POST /api/users/invite,
 * change roles straight on `users` under RLS (users_update lets CRO Admin
 * change anyone), and deactivate through POST /api/users/[id]/deactivate.
 */

export interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  archived_at: string | null;
  last_sign_in_at: string | null;
  account_id: string | null;
  account_name: string | null;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function PersonCell({ person, you }: { person: PersonRow; you?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
        {initials(person.full_name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-neutral-800">
          {person.full_name}
          {you && <span className="font-normal text-neutral-400"> (you)</span>}
        </span>
        <span className="block truncate text-caption text-neutral-500">{person.email}</span>
      </span>
    </div>
  );
}

export function lastLoginLabel(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StatusBadge({ deactivated }: { deactivated: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-caption font-semibold",
        deactivated ? "bg-neutral-200 text-neutral-700" : "bg-success-100 text-success-800"
      )}
    >
      {deactivated ? "Deactivated" : "Active"}
    </span>
  );
}

/** A role picker that saves as soon as it changes. */
export function RoleSelect({
  person,
  roles,
  onChanged,
}: {
  person: PersonRow;
  roles: UserRole[];
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const change = async (role: UserRole) => {
    setPending(true);
    const { error } = await createClient().from("users").update({ role }).eq("id", person.id);
    setPending(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${person.full_name} is now ${ROLE_LABELS[role]}.`);
    onChanged();
  };
  return (
    <Select value={person.role} onValueChange={(v) => change(v as UserRole)}>
      <SelectTrigger className="h-8 w-48" disabled={pending} aria-label={`Role for ${person.full_name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Deactivate, behind a confirmation, as on Users & Roles. */
export function DeactivateButton({ person, onDone }: { person: PersonRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    const res = await fetch(`/api/users/${person.id}/deactivate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setPending(false);
    setOpen(false);
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't deactivate that user.");
      return;
    }
    toast.success(`${person.full_name} deactivated.`);
    onDone();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2.5 py-1 text-caption font-semibold text-error-700 hover:bg-error-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        Deactivate
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              {person.full_name} will immediately lose access to GrowthMission. This can&apos;t be undone from this screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={run} disabled={pending}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Invite a team member (no client) or a client user (a client is required). */
export function InvitePersonDialog({
  open,
  onOpenChange,
  kind,
  roles,
  clients,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "team" | "client";
  roles: UserRole[];
  clients?: { id: string; name: string }[];
  onInvited: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [accountId, setAccountId] = useState("");
  const [sending, setSending] = useState(false);

  const team = kind === "team";
  const ready = !!fullName.trim() && /\S+@\S+\.\S+/.test(email.trim()) && !!role && (team || !!accountId);

  const send = async () => {
    if (!ready) return;
    setSending(true);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        ...(team ? {} : { account_id: accountId }),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't send that invite.");
      return;
    }
    toast.success(`Invite sent to ${email.trim()}.`);
    setFullName("");
    setEmail("");
    setRole("");
    setAccountId("");
    onOpenChange(false);
    onInvited();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Invite a CRO Leader team member" : "Invite a client user"}</DialogTitle>
          <DialogDescription>
            {team
              ? "They work across every client from this dashboard."
              : "They join one client and see only that client's GrowthMission."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor={`${kind}-invite-name`} required>
              Full Name
            </Label>
            <Input id={`${kind}-invite-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`${kind}-invite-email`} required>
              Email
            </Label>
            <Input id={`${kind}-invite-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {!team && (
            <div>
              <Label htmlFor="client-invite-account" required>
                Client
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="client-invite-account">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor={`${kind}-invite-role`} required>
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id={`${kind}-invite-role`}>
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!ready || sending}>
            {sending ? "Sending…" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
