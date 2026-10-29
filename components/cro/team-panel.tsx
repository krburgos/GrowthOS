"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  InvitePersonDialog,
  PersonActions,
  PersonCell,
  RoleSelect,
  StatusBadge,
  lastLoginLabel,
  type PersonRow,
} from "@/components/cro/people-bits";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { useFlash } from "@/lib/use-flash";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { CRO_LEADER_ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const HEAD = "h-10 px-3 text-left text-caption font-bold uppercase tracking-wide text-primary-700";

/**
 * CRO Leader Team on the CRO Leader dashboard (client-confirmed, 2026-10-22,
 * approved mockup "CRO Dashboard People"). The team works across every
 * client, so it is managed here rather than inside any one client's
 * Settings. CRO Admin only. Nobody changes or deactivates themselves here.
 */
export function CroTeamPanel({
  members,
  currentUserId,
  focusSlot,
}: {
  members: PersonRow[];
  currentUserId: string;
  focusSlot?: ReactNode;
}) {
  const router = useRouter();
  // The saved-row glow after a role change (Design System §Motion, 2026-10-22).
  const { flashId, flash } = useFlash();
  const [inviting, setInviting] = useState(false);
  const active = members.filter((m) => !m.archived_at);
  const count = (role: string) => active.filter((m) => m.role === role).length;
  // "2 CRO Leader Admins · 1 CRO Leader Advisor", skipping roles nobody holds.
  const summary = CRO_LEADER_ROLES.filter((r) => count(r) > 0)
    .map((r) => `${count(r)} ${ROLE_LABELS[r]}${count(r) === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">CRO Leader Team</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">{summary} · they can enter every client</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {focusSlot}
          <Button size="sm" variant="secondary" className="border-transparent hover:border-transparent" onClick={() => setInviting(true)}>
            <Plus className="mr-1.5 size-4" />
            Invite team member
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-body">
          <thead className="bg-primary-50">
            <tr className="border-b border-primary-200">
              <th className={HEAD}>Name</th>
              <th className={HEAD}>Role</th>
              <th className={HEAD}>Last login</th>
              <th className={HEAD}>Status</th>
              <th className={HEAD}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const you = m.id === currentUserId;
              const off = !!m.archived_at;
              return (
                <tr key={m.id} className={cn(off ? "border-b border-neutral-100 opacity-60" : "border-b border-neutral-100 hover:bg-neutral-50", flashId === m.id && "animate-saved")}>
                  <td className="px-3 py-2.5">
                    <PersonCell person={m} you={you} />
                  </td>
                  <td className="px-3 py-2.5">
                    {you || off ? (
                      <span className="text-body-sm text-neutral-600">{ROLE_LABELS[m.role]}</span>
                    ) : (
                      <RoleSelect person={m} roles={CRO_LEADER_ROLES} onChanged={() => {
                        flash(m.id);
                        router.refresh();
                      }} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-body-sm text-neutral-600">{lastLoginLabel(m.last_sign_in_at)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge person={m} />
                  </td>
                  <td className="px-3 py-2.5">
                    {!you && <PersonActions person={m} onDone={() => router.refresh()} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InvitePersonDialog
        open={inviting}
        onOpenChange={setInviting}
        kind="team"
        roles={CRO_LEADER_ROLES}
        onInvited={() => router.refresh()}
      />
    </section>
  );
}
