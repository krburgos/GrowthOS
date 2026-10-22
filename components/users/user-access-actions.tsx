"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  // One ⋯ menu per row, like the Arsenal's file menu (client-confirmed,
  // 2026-10-22): two text buttons took a whole column.
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Access for ${name}`}
            className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {deactivated ? (
            <DropdownMenuItem onSelect={() => setAction("reactivate")}>Reactivate</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setAction("deactivate")}>Deactivate</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAction("remove")} className="text-error-700">
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
