"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import {
  DeactivateButton,
  InvitePersonDialog,
  PersonCell,
  RoleSelect,
  StatusBadge,
  lastLoginLabel,
  type PersonRow,
} from "@/components/cro/people-bits";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { MSP_ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const HEAD = "h-10 px-3 text-left text-caption font-bold uppercase tracking-wide text-primary-700";
const LABEL = "text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700";

/**
 * All Users on the CRO Leader dashboard (client-confirmed, 2026-10-22,
 * approved mockup "CRO Dashboard People"): every client's users in one
 * place, filtered by client, role or a search, with invite into any client,
 * role changes among the client roles, and deactivation. CRO Admin only.
 * Client Owners and Admins still manage their own users in their Settings.
 */
export function AllUsersPanel({
  users,
  clients,
  focusSlot,
}: {
  users: PersonRow[];
  clients: { id: string; name: string }[];
  focusSlot?: ReactNode;
}) {
  const router = useRouter();
  const [client, setClient] = useState("all");
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [inviting, setInviting] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (client === "all" || u.account_id === client) &&
        (role === "all" || u.role === role) &&
        (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, client, role, query]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = users.filter((u) => !u.archived_at).length;
  const on = (v: string) => (v !== "all" ? "border-primary-700 bg-primary-50 font-semibold text-primary-900" : "bg-white");

  return (
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">All Users</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {activeCount} active {activeCount === 1 ? "user" : "users"} across {clients.length} {clients.length === 1 ? "client" : "clients"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {focusSlot}
          <Button size="sm" variant="secondary" className="border-transparent hover:border-transparent" onClick={() => setInviting(true)}>
            <Plus className="mr-1.5 size-4" />
            Invite user
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
        <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
          <Filter className="size-4 text-secondary-700" aria-hidden="true" />
          Filter
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Client</span>
          <Select
            value={client}
            onValueChange={(v) => {
              setClient(v);
              setPage(1);
            }}
          >
            <SelectTrigger className={cn("h-8 w-64 text-body-sm", on(client))} aria-label="Client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Role</span>
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v);
              setPage(1);
            }}
          >
            <SelectTrigger className={cn("h-8 w-40 text-body-sm", on(role))} aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {MSP_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Search</span>
          <span className="flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Name or email"
              className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </span>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
          {users.length === 0 ? "No client users yet." : "No users match these filters."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-body">
              <thead className="bg-primary-50">
                <tr className="border-b border-primary-200">
                  <th className={HEAD}>Name</th>
                  <th className={HEAD}>Client</th>
                  <th className={HEAD}>Role</th>
                  <th className={HEAD}>Last login</th>
                  <th className={HEAD}>Status</th>
                  <th className={HEAD}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => {
                  const off = !!u.archived_at;
                  return (
                    <tr key={u.id} className={off ? "border-b border-neutral-100 opacity-60" : "border-b border-neutral-100 hover:bg-neutral-50"}>
                      <td className="px-3 py-2.5">
                        <PersonCell person={u} />
                      </td>
                      <td className="max-w-[240px] truncate px-3 py-2.5 text-body-sm font-medium text-neutral-800" title={u.account_name ?? undefined}>
                        {u.account_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {off ? (
                          <span className="text-body-sm text-neutral-500">{ROLE_LABELS[u.role]}</span>
                        ) : (
                          <RoleSelect person={u} roles={MSP_ROLES} onChanged={() => router.refresh()} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-body-sm text-neutral-600">{lastLoginLabel(u.last_sign_in_at)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge deactivated={off} />
                      </td>
                      <td className="px-3 py-2.5">
                        {!off && (
                          <div className="flex justify-end">
                            <DeactivateButton person={u} onDone={() => router.refresh()} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-primary-200 bg-primary-50 px-4">
            <LocalPaginationBar
              page={page}
              pageSize={pageSize}
              totalCount={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <InvitePersonDialog
        open={inviting}
        onOpenChange={setInviting}
        kind="client"
        roles={MSP_ROLES}
        clients={clients}
        onInvited={() => router.refresh()}
      />
    </section>
  );
}
