"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

  const handleRoleChange = async (userId: string, role: string) => {
    setPendingId(userId);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    setPendingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Role updated.");
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
      <Table>
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
              <TableCell className="font-medium text-neutral-800">{u.full_name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                {canEdit && u.id !== currentUserId ? (
                  <Select
                    value={u.role}
                    onValueChange={(value) => handleRoleChange(u.id, value)}
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
              <TableCell>
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
              </TableCell>
              <TableCell>
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

      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user</DialogTitle>
            <DialogDescription>
              {deactivateTarget?.full_name} will immediately lose access to GrowthOS. This can&apos;t
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
