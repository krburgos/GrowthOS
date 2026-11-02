"use client";

import { Check, Mail, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send welcome / Send again on All Users (client-confirmed, 2026-11-02,
 * approved mockup "Welcome Email CC"), for an active client user who has
 * never logged in. Opens a dialog with an empty Cc field: type an address
 * and press Enter (or a comma or semicolon) to add it; × or Backspace
 * removes one. One person per send.
 */
export function SendWelcomeButton({
  userId,
  name,
  email,
  accountName,
  sentBefore,
  onDone,
}: {
  userId: string;
  name: string;
  email: string;
  accountName: string | null;
  sentBefore: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cc, setCc] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const reset = () => {
    setCc([]);
    setDraft("");
    setBad(false);
  };

  /** Adds what's typed; false when it isn't an address. */
  const commit = (): string[] | null => {
    const v = draft.trim().replace(/[,;]+$/, "");
    if (!v) {
      setBad(false);
      return cc;
    }
    if (!EMAIL_RE.test(v)) {
      setBad(true);
      return null;
    }
    const next = cc.some((c) => c.toLowerCase() === v.toLowerCase()) ? cc : [...cc, v];
    setCc(next);
    setDraft("");
    setBad(false);
    return next;
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && cc.length) {
      setCc(cc.slice(0, -1));
    }
  };

  const send = async () => {
    const list = commit();
    if (!list) return;
    setState("sending");
    const res = await fetch(`/api/users/${userId}/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cc: list }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      toast.error(body.error ?? "Couldn't send the welcome email.");
      return;
    }
    setOpen(false);
    reset();
    setState("sent");
    toast.success(`Welcome email sent to ${email}.`);
    setTimeout(() => {
      setState("idle");
      onDone();
    }, 1500);
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={state !== "idle"}>
        {state === "sent" ? (
          <>
            <Check className="mr-1 size-3.5 text-success-700" />
            Sent
          </>
        ) : (
          <>
            <Mail className="mr-1.5 size-3.5" />
            {sentBefore ? "Send again" : "Send welcome"}
          </>
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Send welcome email</DialogTitle>
            <DialogDescription className="truncate">
              {name}
              {accountName ? ` · ${accountName}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-body-sm font-semibold text-neutral-600">To</span>
              <span className="truncate text-body-sm text-neutral-800">{email}</span>
            </div>
            <div className="flex items-start gap-3">
              <label htmlFor={`welcome-cc-${userId}`} className="w-8 shrink-0 pt-2 text-body-sm font-semibold text-neutral-600">
                Cc
              </label>
              <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-neutral-300 px-2 py-1 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
                {cc.map((c) => (
                  <span
                    key={c}
                    className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-primary-100 pl-2.5 pr-1 text-caption font-semibold text-primary-800"
                  >
                    <span className="truncate">{c}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setCc(cc.filter((x) => x !== c))}
                      className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-primary-200"
                      aria-label={`Remove ${c}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  id={`welcome-cc-${userId}`}
                  type="email"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setBad(false);
                  }}
                  onKeyDown={onKey}
                  onBlur={() => commit()}
                  placeholder="Type an address, press Enter"
                  className="h-7 min-w-[160px] flex-1 border-0 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                />
              </div>
            </div>
            {bad && <p className="pl-11 text-caption text-error-700">That doesn&apos;t look like an email address.</p>}
            <p className="border-t border-neutral-100 pt-3 text-caption text-neutral-500">
              Cc&apos;d people get the same email, including the Set your password link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void send()} disabled={state === "sending"}>
              <Mail className="mr-1.5 size-4" />
              {state === "sending" ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
