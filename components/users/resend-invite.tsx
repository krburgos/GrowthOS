"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Invited badge and Resend invite (client-confirmed, 2026-10-29, approved
 * mockup "Resend Invite"), for someone who never accepted their invite. Used
 * on the CRO Leader Team and All Users sections and in Settings › Users &
 * Roles. Resend only opens once the current link has expired (client
 * request, same day); before then it is disabled and says until when.
 */

const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const timeLabel = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function InvitedBadge({ sentAt, className }: { sentAt: Date; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn(className, "bg-secondary-100 text-secondary-800")}>Invited</span>
      <InfoTip label="About this invite" text={`Invited ${dateLabel(sentAt)}. Hasn't set a password yet.`} />
    </span>
  );
}

export function ResendInviteButton({
  userId,
  email,
  expiresAt,
  onDone,
}: {
  userId: string;
  email: string;
  expiresAt: Date;
  onDone: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [now, setNow] = useState(() => Date.now());
  const live = expiresAt.getTime() > now;

  // Opens by itself when the link runs out while the page is open.
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setNow(Date.now()), expiresAt.getTime() - now + 1000);
    return () => clearTimeout(t);
  }, [live, expiresAt, now]);

  const send = async () => {
    setState("sending");
    const res = await fetch(`/api/users/${userId}/resend-invite`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      toast.error(body.error ?? "Couldn't resend that invite.");
      return;
    }
    setState("sent");
    toast.success(`New invite sent to ${email}.`);
    setTimeout(() => {
      setState("idle");
      onDone();
    }, 3000);
  };

  const button = (
    <Button size="sm" variant="secondary" onClick={() => void send()} disabled={live || state !== "idle"}>
      {state === "sent" ? (
        <>
          <Check className="mr-1 size-3.5 text-success-700" />
          Sent
        </>
      ) : state === "sending" ? (
        "Sending…"
      ) : (
        "Resend invite"
      )}
    </Button>
  );

  if (!live || state !== "idle") return button;
  // A disabled button gets no hover, so the tooltip hangs on a wrapper.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-center font-medium">
        Their invite link works until {timeLabel(expiresAt)}. You can resend it after that.
      </TooltipContent>
    </Tooltip>
  );
}
