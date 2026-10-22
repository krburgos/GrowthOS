"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/lib/auth/get-current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { CRO_LEADER_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  archived_at: string | null;
  last_sign_in_at: string | null;
}

export function UsersTable({
  users,
  assignableRoles,
  canEdit,
  currentUserId,
}: {
  users: UserRow[];
  assignableRoles: UserRole[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  // A move from an MSP role to a CRO Leader role, waiting on confirmation.
  const [promoteTarget, setPromoteTarget] = useState<{ user: UserRow; role: UserRole } | null>(null);

  /**
   * Bug fix (2026-10-22): a CRO Leader role belongs to no account
   * (users_account_id_matches_role), but this only changed `role`, so
   * every MSP → CRO Leader change was refused by the database. Moving to a
   * CRO Leader role now clears account_id too, after a confirmation,
   * because the person leaves this account's list and works across every
   * account instead.
   */
  const handleRoleChange = async (target: UserRow, role: UserRole, confirmed = false) => {
    const toCroLeader = CRO_LEADER_ROLES.includes(role) && !CRO_LEADER_ROLES.includes(target.role);
    if (toCroLeader && !confirmed) {
      setPromoteTarget({ user: target, role });
      return;
    }
    setPendingId(target.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update(toCroLeader ? { role, account_id: null } : { role })
      .eq("id", target.id);
    setPendingId(null);
    setPromoteTarget(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(
      toCroLeader
        ? `${target.full_name} is now ${ROLE_LABELS[role]}. They've left this account's list and can enter every account from the CRO Leader dashboard.`
        : "Role updated."
    );
    router.refresh();
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setPendingId(deactivateTarget.id);

    const res = await fetch(`/api/users/${deactivateTarget.id}/deactivate`, { method: "POST" });
    const body = await res.json();

    setPendingId(null);
    setDeactivateTarget(null);

    if (!res.ok) {
      toast.error(body.error ?? "Couldn't deactivate that user.");
      return;
    }
    toast.success(`${deactivateTarget.full_name} deactivated.`);
    router.refresh();
  };

  return (
    <>
      <Table stacked>
        <TableHeader variant="solid">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead variant="solid">Name</TableHead>
            <TableHead variant="solid">Email</TableHead>
            <TableHead variant="solid">Role</TableHead>
            <TableHead variant="solid">Last Login</TableHead>
            <TableHead variant="solid">Status</TableHead>
            {canEdit && <TableHead variant="solid">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell label="Name" className="font-medium text-neutral-800">{u.full_name}</TableCell>
              <TableCell label="Email" className="break-all">{u.email}</TableCell>
              <TableCell label="Role">
                {canEdit && u.id !== currentUserId ? (
                  <Select
                    value={u.role}
                    onValueChange={(value) => handleRoleChange(u, value as UserRole)}
                  >
                    <SelectTrigger className="h-8 w-48" disabled={pendingId === u.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="info">{ROLE_LABELS[u.role]}</Badge>
                )}
              </TableCell>
              <TableCell label="Last login">
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
              </TableCell>
              <TableCell label="Status">
                {u.archived_at ? (
                  <Badge variant="neutral">Deactivated</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                )}
              </TableCell>
              {canEdit && (
                <TableCell>
                  {!u.archived_at && u.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeactivateTarget(u)}
                    >
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make {promoteTarget?.user.full_name} {promoteTarget ? ROLE_LABELS[promoteTarget.role] : ""}?</DialogTitle>
            <DialogDescription>
              CRO Leader roles work across every account rather than belonging to one, so{" "}
              {promoteTarget?.user.full_name} will leave this account&apos;s user list. They&apos;ll sign in to the CRO
              Leader dashboard and can enter this account, and every other, from there.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromoteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => promoteTarget && handleRoleChange(promoteTarget.user, promoteTarget.role, true)}
              disabled={pendingId === promoteTarget?.user.id}
            >
              Make {promoteTarget ? ROLE_LABELS[promoteTarget.role] : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              {deactivateTarget?.full_name} will immediately lose access to GrowthMission. This can&apos;t
              be undone from this screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={pendingId === deactivateTarget?.id}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
