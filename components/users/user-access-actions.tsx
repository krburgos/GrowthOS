"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Action = "deactivate" | "reactivate" | "remove";

const COPY: Record<Action, { title: (n: string) => string; body: (n: string) => string; label: string; done: (n: string) => string }> = {
  deactivate: {
    title: (n) => `Deactivate ${n}?`,
    body: (n) => `${n} can't sign in until reactivated. They stay on this list, greyed out, so you can reactivate them later.`,
    label: "Deactivate",
    done: (n) => `${n} deactivated.`,
  },
  reactivate: {
    title: (n) => `Reactivate ${n}?`,
    body: (n) => `${n} can sign in again with their existing password, with the same role as before.`,
    label: "Reactivate",
    done: (n) => `${n} reactivated.`,
  },
  remove: {
    title: (n) => `Remove ${n}?`,
    body: (n) =>
      `${n} won't be able to sign in and will no longer appear in any user list. Their past work, calls, notes and contacts they own, keeps their name. To bring them back, invite the same email again.`,
    label: "Remove",
    done: (n) => `${n} removed.`,
  },
};

/**
 * A user's access actions (client-confirmed, 2026-10-22, approved mockup
 * "CRO Dashboard People" v2): Deactivate pauses (Reactivate undoes it) and
 * Remove takes someone off every list. Nothing is deleted. Used on the CRO
 * Leader Team and All Users sections and in Settings › Users & Roles; the
 * routes decide who may act on whom.
 */
export function UserAccessActions({
  userId,
  name,
  deactivated,
  onDone,
}: {
  userId: string;
  name: string;
  deactivated: boolean;
  onDone: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);

  const run = async () => {
    if (!action) return;
    setPending(true);
    const res = await fetch(`/api/users/${userId}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setPending(false);
    const done = action;
    setAction(null);
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't change that user's access.");
      return;
    }
    toast.success(COPY[done].done(name));
    onDone();
  };

  const link = "rounded-md px-2.5 py-1 text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40";

  return (
    <div className="flex justify-end gap-1">
      {deactivated ? (
        <button type="button" onClick={() => setAction("reactivate")} className={cn(link, "text-secondary-700 hover:bg-secondary-50")}>
          Reactivate
        </button>
      ) : (
        <button type="button" onClick={() => setAction("deactivate")} className={cn(link, "text-neutral-600 hover:bg-neutral-100")}>
          Deactivate
        </button>
      )}
      <button type="button" onClick={() => setAction("remove")} className={cn(link, "text-error-700 hover:bg-error-100")}>
        Remove
      </button>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[action].title(name)}</DialogTitle>
                <DialogDescription>{COPY[action].body(name)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button variant={action === "remove" ? "destructive" : "primary"} onClick={run} disabled={pending}>
                  {COPY[action].label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
