"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { InvitedBadge, ResendInviteButton } from "@/components/users/resend-invite";
import { SendWelcomeButton } from "@/components/users/send-welcome";
import { UserAccessActions } from "@/components/users/user-access-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/lib/auth/get-current-user";
import { inviteExpiresAt } from "@/lib/auth/invite-link";
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
  invite_sent_at: string | null;
  email_confirmed_at: string | null;
  /** Last welcome email (2026-11-02); All Users only. */
  welcome_sent_at: string | null;
  /** Latest invite's send time and sender (2026-11-23); All Users only. Sender is null for invites sent before then. */
  invited_at?: string | null;
  invited_by_name?: string | null;
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

/**
 * Name, email and initials. With `onRenamed`, a pencil beside the name
 * (shown on row hover, so the row needs `group`) renames the person in
 * place: Enter or ✓ saves, Esc or ✕ cancels, a blank name is refused.
 * Client-confirmed 2026-11-17 (approved mockup "Rename People Mockup").
 * Saved straight to `users` under RLS: users_update lets CRO Admin change
 * anyone, and only CRO Admins see these sections.
 */
export function PersonCell({ person, you, onRenamed }: { person: PersonRow; you?: boolean; onRenamed?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.full_name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(person.full_name);
    setEditing(true);
  };
  const save = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error("A name can't be empty.");
      return;
    }
    if (next === person.full_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await createClient().from("users").update({ full_name: next }).eq("id", person.id);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Name changed to ${next}.`);
    setEditing(false);
    onRenamed?.();
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
        {initials(person.full_name)}
      </span>
      <span className="min-w-0">
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              aria-label={`Name for ${person.full_name}`}
              className="h-8 w-56 min-w-0 rounded-md border border-secondary-400 bg-white px-2.5 text-body-sm text-neutral-800 outline-none ring-2 ring-secondary-500/25"
            />
            {saving ? (
              <Spinner className="size-4" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void save()}
                  aria-label="Save name"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-success-700 hover:bg-success-100"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label="Cancel renaming"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-medium text-neutral-800">
              {person.full_name}
              {you && <span className="font-normal text-neutral-400"> (you)</span>}
            </span>
            {onRenamed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={start}
                    aria-label={`Rename ${person.full_name}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-primary-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 group-hover:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>
            )}
          </span>
        )}
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

const STATUS_PILL = "inline-flex rounded-full px-2.5 py-0.5 text-caption font-semibold";

/** Deactivated wins over Invited: someone deactivated can't accept anyway. */
export function StatusBadge({ person }: { person: PersonRow }) {
  if (!person.archived_at && inviteExpiresAt(person) && person.invite_sent_at) {
    return <InvitedBadge sentAt={new Date(person.invite_sent_at)} className={STATUS_PILL} />;
  }
  const deactivated = !!person.archived_at;
  const welcomed = !deactivated && !person.last_sign_in_at && person.welcome_sent_at;
  return (
    <>
      <span className={cn(STATUS_PILL, deactivated ? "bg-neutral-200 text-neutral-700" : "bg-success-100 text-success-800")}>
        {deactivated ? "Deactivated" : "Active"}
      </span>
      {welcomed && (
        <span className="mt-1 block text-caption text-neutral-500">
          Welcome sent {new Date(welcomed).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </>
  );
}

/** Send welcome (2026-11-02): an active person past their invite who has never logged in. */
export function canWelcome(person: PersonRow): boolean {
  return !person.archived_at && !person.last_sign_in_at && !inviteExpiresAt(person);
}

/**
 * Resend invite beside the ⋯ menu, only for an active person whose invite is
 * pending; with `welcome` (All Users), Send welcome for someone who never logged in.
 */
export function PersonActions({ person, onDone, welcome }: { person: PersonRow; onDone: () => void; welcome?: boolean }) {
  const expiresAt = person.archived_at ? null : inviteExpiresAt(person);
  return (
    <div className="flex items-center justify-end gap-2">
      {expiresAt && <ResendInviteButton userId={person.id} email={person.email} expiresAt={expiresAt} onDone={onDone} />}
      {welcome && canWelcome(person) && (
        <SendWelcomeButton
          userId={person.id}
          name={person.full_name}
          email={person.email}
          accountName={person.account_name}
          sentBefore={!!person.welcome_sent_at}
          onDone={onDone}
        />
      )}
      <UserAccessActions userId={person.id} name={person.full_name} deactivated={!!person.archived_at} onDone={onDone} />
    </div>
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
      <SelectTrigger
        className="h-8 w-60 whitespace-nowrap [&>span]:truncate"
        disabled={pending}
        aria-label={`Role for ${person.full_name}`}
      >
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
