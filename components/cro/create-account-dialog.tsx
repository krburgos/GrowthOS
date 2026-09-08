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

/** Backend Schema §10 — POST /api/accounts, CRO Admin only. New MSP account + initial Owner invite in one step. */
export function CreateAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [pending, setPending] = useState(false);

  const canSave = accountName.trim() && ownerEmail.trim() && ownerFullName.trim();

  const handleCreate = async () => {
    setPending(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName, ownerEmail, ownerFullName }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't create that account — please try again.");
      return;
    }

    toast.success(`${accountName} created — invite sent to ${ownerEmail}.`);
    setOpen(false);
    setAccountName("");
    setOwnerEmail("");
    setOwnerFullName("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New MSP Account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create MSP Account</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="account-name" required>
              Account Name
            </Label>
            <Input id="account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="owner-full-name" required>
              Owner's Full Name
            </Label>
            <Input id="owner-full-name" value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="owner-email" required>
              Owner's Email
            </Label>
            <Input id="owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            <p className="mt-1 text-caption text-neutral-500">They'll get an invite email to set their password and log in.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSave || pending}>
            {pending ? "Creating…" : "Create & Invite Owner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
