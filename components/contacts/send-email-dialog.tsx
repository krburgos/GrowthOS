"use client";

import { Send } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface FromOption {
  id: string;
  label: string;
}

const SELF = "self";

/**
 * Client-confirmed addition (2026-09-08) — Contact Detail's "Email"
 * button. Sends through POST /api/email/send (Resend, Tech Stack
 * Lockfile §5.2) and logs the send as an Activity automatically — no
 * separate "log this" step.
 *
 * Same-day follow-up: a From picker and a Cc field. From defaults to
 * the sender's own identity; picking a teammate's connected mailbox
 * (fromOptions, account-wide per the client-confirmed reversal of part
 * of Backend Schema §6.3) only changes the outgoing email's display
 * From/Reply-To — it's still relayed through Resend, never that
 * teammate's actual Gmail/Outlook. Cc is a plain comma/semicolon-
 * separated address list, validated server-side.
 */
export function SendEmailDialog({
  contactId,
  contactName,
  contactEmail,
  currentUserName,
  fromOptions,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string;
  currentUserName: string;
  fromOptions: FromOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromConnectionId, setFromConnectionId] = useState(SELF);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  const handleSend = async () => {
    setPending(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        subject,
        body,
        cc: cc.trim() || undefined,
        fromConnectionId: fromConnectionId === SELF ? null : fromConnectionId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't send that email — please try again.");
      return;
    }

    toast.success(`Email sent to ${contactName}.`);
    setOpen(false);
    setFromConnectionId(SELF);
    setCc("");
    setSubject("");
    setBody("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex aspect-square shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-3.5 text-center transition-colors hover:border-secondary-300 hover:bg-secondary-50"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-sm">
            <Send className="size-4" />
          </span>
          <span className="text-caption font-semibold text-neutral-700">Send Email</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email {contactName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email-from">From</Label>
            <Select value={fromConnectionId} onValueChange={setFromConnectionId}>
              <SelectTrigger id="email-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF}>{currentUserName} (you)</SelectItem>
                {fromOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" value={contactEmail} disabled />
          </div>

          <div>
            <Label htmlFor="email-cc">Cc</Label>
            <Input
              id="email-cc"
              placeholder="cc@example.com, another@example.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="email-subject" required>
              Subject
            </Label>
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="email-body" required>
              Message
            </Label>
            <Textarea id="email-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={pending || !subject.trim() || !body.trim()}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
