"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface PartnerRow {
  id: string;
  fullName: string;
  email: string;
  grants: { accountId: string; accountName: string }[];
}

/**
 * Client-confirmed addition (2026-09-08) — CRO Admin's partner
 * management: invite a partner user, then grant/revoke exactly which
 * MSP accounts they can see (partner_account_grants). CRO Admin grants
 * unilaterally, no MSP-side consent step, per the client's explicit
 * direction.
 */
export function PartnerAccessPanel({
  partners,
  allAccounts,
}: {
  partners: PartnerRow[];
  allAccounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [pickedAccountId, setPickedAccountId] = useState("");
  const [pending, setPending] = useState(false);

  const handleInvite = async () => {
    setInviting(true);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role: "partner" }),
    });
    const data = await res.json().catch(() => ({}));
    setInviting(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't send that invite.");
      return;
    }

    toast.success(`Invite sent to ${email}.`);
    setInviteOpen(false);
    setEmail("");
    setFullName("");
    router.refresh();
  };

  const addGrant = async (partnerUserId: string) => {
    if (!pickedAccountId) return;
    setPending(true);
    const res = await fetch("/api/cro/partner-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerUserId, accountId: pickedAccountId }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't add that grant.");
      return;
    }

    setAddingFor(null);
    setPickedAccountId("");
    router.refresh();
  };

  const removeGrant = async (partnerUserId: string, accountId: string) => {
    setPending(true);
    const res = await fetch("/api/cro/partner-grants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerUserId, accountId }),
    });
    setPending(false);

    if (!res.ok) {
      toast.error("Couldn't remove that grant.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">Partners</h2>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Invite Partner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Partner</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="partner-name" required>
                  Full Name
                </Label>
                <Input id="partner-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="partner-email" required>
                  Email
                </Label>
                <Input id="partner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <p className="mt-1 text-caption text-neutral-500">
                  They'll get an invite email, then you can grant them access to specific accounts below.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={!email.trim() || !fullName.trim() || inviting}>
                {inviting ? "Sending…" : "Send Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {partners.length === 0 ? (
        <p className="px-4 py-6 text-body-sm text-neutral-500">No partners invited yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-col gap-2.5 px-4 py-3.5">
              <div>
                <p className="text-body font-semibold text-neutral-800">{p.fullName}</p>
                <p className="text-caption text-neutral-500">{p.email}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {p.grants.length === 0 && <span className="text-caption text-neutral-400">No accounts granted yet</span>}
                {p.grants.map((g) => (
                  <span
                    key={g.accountId}
                    className="flex items-center gap-1.5 rounded-full bg-secondary-50 px-2.5 py-1 text-caption font-medium text-secondary-800"
                  >
                    {g.accountName}
                    <button
                      type="button"
                      onClick={() => removeGrant(p.id, g.accountId)}
                      disabled={pending}
                      aria-label={`Remove ${g.accountName} access`}
                      className="text-secondary-500 hover:text-error-700"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {addingFor === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <Select value={pickedAccountId} onValueChange={setPickedAccountId}>
                      <SelectTrigger className="h-7 w-44 text-caption">
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent>
                        {allAccounts
                          .filter((a) => !p.grants.some((g) => g.accountId === a.id))
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => addGrant(p.id)} disabled={!pickedAccountId || pending}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingFor(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingFor(p.id)}
                    className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-caption font-semibold text-neutral-500 hover:border-secondary-400 hover:text-secondary-700"
                  >
                    + Add account
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
