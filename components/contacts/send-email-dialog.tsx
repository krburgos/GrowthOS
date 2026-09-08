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
import { Textarea } from "@/components/ui/textarea";

/**
 * Client-confirmed addition (2026-09-08) — Contact Detail's "Email"
 * button. Sends through POST /api/email/send (SendGrid relay via
 * Nodemailer, same mechanism Milestone 10's Campaigns will use) and logs
 * the send as an Activity automatically — no separate "log this" step.
 */
export function SendEmailDialog({ contactId, contactName, contactEmail }: { contactId: string; contactName: string; contactEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  const handleSend = async () => {
    setPending(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, subject, body }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error || "Couldn't send that email — please try again.");
      return;
    }

    toast.success(`Email sent to ${contactName}.`);
    setOpen(false);
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
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" value={contactEmail} disabled />
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
