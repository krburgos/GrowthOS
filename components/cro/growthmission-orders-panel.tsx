"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  DUE_OPTIONS,
  matchesDue,
  type Due,
} from "@/components/growth-mission/mission-orders";
import {
  OwnerAvatar,
  PriorityChip,
  StatePill,
  formatDue,
  isOverdue,
} from "@/components/growth-mission/order-bits";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FilterField,
  FilterResult,
  FilterTitle,
  filterTriggerClass,
} from "@/components/ui/filter-bar";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortHeading, useTableSort } from "@/components/ui/sort-heading";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { CREDITS_PER_HOUR } from "@/lib/growth-mission/capacity";
import {
  SHORT_TITLE,
  formatWhole,
  roundUpToQuarterHour,
} from "@/lib/growth-mission/hours";
import type { TaskPriority, TaskState } from "@/lib/growth-mission/tasks";
import { createClient } from "@/lib/supabase/client";
import { useFlash } from "@/lib/use-flash";
import { cn } from "@/lib/utils";

export interface CroOrderRow {
  id: string;
  accountId: string;
  accountName: string;
  step_slug: string;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  state: TaskState;
  hours: number;
  due_date: string | null;
  /** The "2" in "Must 2", among all the client's open orders on that Mission Card. */
  rank?: number;
  croOwnerId: string | null;
}

const ANY = "__any__";
const NONE = "__none__";
const COLS =
  "grid grid-cols-[170px_76px_minmax(220px,1fr)_150px_190px_118px_96px_64px_64px] items-center gap-x-3";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const cardName = (slug: string) => SHORT_TITLE[slug] ?? slug;
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * GrowthMission Orders on the CRO Leader dashboard (client-confirmed,
 * 2026-10-27, approved mockup "CRO GrowthMission Orders"): every order a
 * client has delegated to GrowthMission, across every client, in the
 * Mission Orders table's blue frame. CRO Admin/Advisor assign each one to
 * someone on the CRO Leader team and edit its hours and due date in place;
 * Service Team reads only, as RLS already has it. A row enters the client
 * and opens the order on its Mission Card, where status and completion
 * stay. Opens on open orders, soonest due first.
 */
export function GrowthMissionOrdersPanel({
  orders,
  team,
  ownerNames,
  currentUserId,
  canEdit,
  focusSlot,
}: {
  orders: CroOrderRow[];
  /** Active CRO Leader team members, for the owner picker. */
  team: { id: string; name: string }[];
  /** Every CRO owner's name, including anyone since deactivated. */
  ownerNames: Record<string, string>;
  currentUserId: string;
  canEdit: boolean;
  focusSlot?: ReactNode;
}) {
  const router = useRouter();
  const { flashId, flash } = useFlash();
  const [rows, setRows] = useState(orders);
  // Fresh server rows after router.refresh() replace the local copy.
  const [prevOrders, setPrevOrders] = useState(orders);
  if (orders !== prevOrders) {
    setPrevOrders(orders);
    setRows(orders);
  }

  const [client, setClient] = useState("");
  const [owner, setOwner] = useState("");
  const [card, setCard] = useState("");
  const [due, setDue] = useState<Due>("");
  const [showDone, setShowDone] = useState(false);

  const open = rows.filter((o) => o.state !== "complete");
  const sum = (list: CroOrderRow[]) => list.reduce((s, o) => s + o.hours, 0);
  const overdue = open.filter(isOverdue).length;
  const unassigned = open.filter((o) => !o.croOwnerId);
  const mine = open.filter((o) => o.croOwnerId === currentUserId);
  const clientCount = new Set(open.map((o) => o.accountId)).size;

  const clients = useMemo(
    () =>
      Array.from(
        new Map(rows.map((o) => [o.accountId, o.accountName])).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [rows],
  );
  const cards = useMemo(
    () =>
      Array.from(new Set(rows.map((o) => o.step_slug))).sort((a, b) =>
        cardName(a).localeCompare(cardName(b)),
      ),
    [rows],
  );

  const visible = rows.filter(
    (o) =>
      (showDone || o.state !== "complete") &&
      (!client || o.accountId === client) &&
      (!owner || (owner === NONE ? !o.croOwnerId : o.croOwnerId === owner)) &&
      (!card || o.step_slug === card) &&
      matchesDue(o, due),
  );
  const { sorted, headingFor } = useTableSort<CroOrderRow, "client" | "priority" | "due">(
    visible,
    {
      client: (o) => o.accountName,
      priority: (o) => PRIORITY_ORDER[o.priority] * 1000 + (o.rank ?? 999),
      due: (o) => o.due_date,
    },
    { key: "due", dir: "asc" },
  );
  // Completed orders, when shown, sit below the open ones whatever the sort.
  const list = [
    ...sorted.filter((o) => o.state !== "complete"),
    ...sorted.filter((o) => o.state === "complete"),
  ];

  const filtered = !!(client || owner || card || due);
  const clear = () => {
    setClient("");
    setOwner("");
    setCard("");
    setDue("");
  };

  const save = async (
    order: CroOrderRow,
    patch: Partial<Pick<CroOrderRow, "hours" | "due_date" | "croOwnerId">>,
    done: string,
  ) => {
    const before = rows;
    setRows((rs) =>
      rs.map((r) => (r.id === order.id ? { ...r, ...patch } : r)),
    );
    const { error } = await createClient()
      .from("growth_mission_tasks")
      .update({
        ...("hours" in patch ? { hours: patch.hours } : {}),
        ...("due_date" in patch ? { due_date: patch.due_date } : {}),
        ...("croOwnerId" in patch ? { cro_owner_id: patch.croOwnerId } : {}),
      })
      .eq("id", order.id);
    if (error) {
      setRows(before);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    flash(order.id);
    toast.success(done);
    router.refresh();
  };

  // Enter the client, landing on this order's panel on its Mission Card.
  const openOrder = (order: CroOrderRow) => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/cro/enter";
    for (const [name, value] of [
      ["accountId", order.accountId],
      ["next", `/growth-mission/${order.step_slug}?order=${order.id}`],
    ]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div
        className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}
      >
        <div className="min-w-0">
          <h2 className="text-h4 text-white">GrowthMission Orders</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {rows.length === 0
              ? "No client has given GrowthMission an order yet."
              : `${open.length} open · ${formatWhole(sum(open))} hrs · ${formatWhole(sum(open) * CREDITS_PER_HOUR)} credits across ${clientCount} ${clientCount === 1 ? "client" : "clients"} · ${overdue} overdue · ${unassigned.length} unassigned`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InfoTip
            label="About GrowthMission Orders"
            text="Every Mission Order a client has given to GrowthMission, across all clients. Open one to work it on its Mission Card."
            className="text-white/45 hover:text-secondary-300"
          />
          {focusSlot}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
            <FilterTitle />
            <FilterField label="Client" tone="blue">
              <Select
                value={client || ANY}
                onValueChange={(v) => setClient(v === ANY ? "" : v)}
              >
                <SelectTrigger
                  aria-label="Client"
                  className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(client !== "")}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All clients</SelectItem>
                  {clients.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="CRO owner" tone="blue">
              <Select
                value={owner || ANY}
                onValueChange={(v) => setOwner(v === ANY ? "" : v)}
              >
                <SelectTrigger
                  aria-label="CRO owner"
                  className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(owner !== "")}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Anyone</SelectItem>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.id === currentUserId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Mission Card" tone="blue">
              <Select
                value={card || ANY}
                onValueChange={(v) => setCard(v === ANY ? "" : v)}
              >
                <SelectTrigger
                  aria-label="Mission Card"
                  className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(card !== "")}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All Mission Cards</SelectItem>
                  {cards.map((s) => (
                    <SelectItem key={s} value={s}>
                      {cardName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Due" tone="blue">
              <Select
                value={due || ANY}
                onValueChange={(v) => setDue(v === ANY ? "" : (v as Due))}
              >
                <SelectTrigger
                  aria-label="Due"
                  className={`h-8 w-auto min-w-[150px] text-body-sm ${filterTriggerClass(due !== "")}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUE_OPTIONS.map((o) => (
                    <SelectItem key={o.value || ANY} value={o.value || ANY}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <label className="ml-auto inline-flex h-8 cursor-pointer items-center gap-2 text-body-sm font-medium text-primary-900">
              <Checkbox
                checked={showDone}
                onCheckedChange={(v) => setShowDone(v === true)}
              />
              Show complete
            </label>
            {filtered && (
              <FilterResult
                shown={list.length}
                total={showDone ? rows.length : open.length}
                noun="orders"
                onClear={clear}
              />
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1220px]">
              <div
                className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}
              >
                <SortHeading label="Client" {...headingFor("client")} />
                <SortHeading label="Priority" {...headingFor("priority")} />
                <span>Mission Order</span>
                <span>Mission Card</span>
                <span>CRO owner</span>
                <span>Status</span>
                <SortHeading label="Due" {...headingFor("due")} />
                <span className="text-right">Hrs</span>
                <span className="text-right">Credits</span>
              </div>

              {list.length === 0 ? (
                <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
                  {filtered ? (
                    <>
                      No orders match these filters.{" "}
                      <button
                        type="button"
                        onClick={clear}
                        className="font-semibold text-secondary-700 hover:text-secondary-800"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : (
                    "Every GrowthMission order is complete."
                  )}
                </p>
              ) : (
                list.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    team={team}
                    ownerName={
                      o.croOwnerId
                        ? (ownerNames[o.croOwnerId] ?? "Former team member")
                        : null
                    }
                    canEdit={canEdit}
                    flashing={flashId === o.id}
                    onOpen={() => openOrder(o)}
                    onSave={(patch, done) => save(o, patch, done)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-primary-200 bg-primary-100 px-5 py-2.5 text-caption tabular-nums text-primary-700">
            <span>
              Open{" "}
              <b className="font-semibold text-primary-900">
                {formatWhole(sum(open))} hrs ·{" "}
                {formatWhole(sum(open) * CREDITS_PER_HOUR)} credits
              </b>
            </span>
            <span>
              Unassigned{" "}
              <b className="font-semibold text-primary-900">
                {unassigned.length}{" "}
                {unassigned.length === 1 ? "order" : "orders"} ·{" "}
                {formatWhole(sum(unassigned))} hrs
              </b>
            </span>
            <span>
              Yours{" "}
              <b className="font-semibold text-primary-900">
                {mine.length} {mine.length === 1 ? "order" : "orders"} ·{" "}
                {formatWhole(sum(mine))} hrs
              </b>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function OrderRow({
  order: o,
  team,
  ownerName,
  canEdit,
  flashing,
  onOpen,
  onSave,
}: {
  order: CroOrderRow;
  team: { id: string; name: string }[];
  ownerName: string | null;
  canEdit: boolean;
  flashing: boolean;
  onOpen: () => void;
  onSave: (
    patch: Partial<Pick<CroOrderRow, "hours" | "due_date" | "croOwnerId">>,
    done: string,
  ) => void;
}) {
  const done = o.state === "complete";
  const due = formatDue(o.due_date);
  const editable = canEdit && !done;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${o.title} — enter ${o.accountName} and open the order`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        `${COLS} min-h-[54px] cursor-pointer border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40`,
        flashing && "animate-saved",
      )}
    >
      <span
        className="truncate text-body-sm font-semibold text-primary-900"
        title={o.accountName}
      >
        {o.accountName}
      </span>
      <span>
        <PriorityChip task={o} rank={o.rank} />
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-body-sm font-semibold ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
          title={o.title}
        >
          {o.title}
        </span>
        {o.detail && (
          <span
            className="block truncate text-caption text-neutral-500"
            title={o.detail}
          >
            {o.detail}
          </span>
        )}
      </span>
      <span className="truncate text-body-sm font-semibold text-neutral-900">
        {cardName(o.step_slug)}
      </span>
      <span className="min-w-0" onClick={stop} onKeyDown={stop}>
        {canEdit ? (
          <Select
            value={o.croOwnerId ?? NONE}
            onValueChange={(v) => {
              const id = v === NONE ? null : v;
              const name = team.find((m) => m.id === id)?.name;
              onSave(
                { croOwnerId: id },
                name ? `${name} now owns “${o.title}”.` : "Order unassigned.",
              );
            }}
          >
            <SelectTrigger
              aria-label={`CRO owner for ${o.title}`}
              className={cn(
                "h-8 text-body-sm [&>span]:truncate",
                !o.croOwnerId && "border-dashed text-neutral-400",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
              {/* Someone since deactivated still shows as the owner until it changes. */}
              {o.croOwnerId && !team.some((m) => m.id === o.croOwnerId) && (
                <SelectItem value={o.croOwnerId} disabled>
                  {ownerName}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <OwnerAvatar
              type={ownerName ? "internal" : null}
              name={ownerName ?? undefined}
            />
            <span
              className={`truncate text-body-sm ${ownerName ? "text-neutral-700" : "text-neutral-400"}`}
            >
              {ownerName ?? "Unassigned"}
            </span>
          </span>
        )}
      </span>
      <span>
        <StatePill state={o.state} />
      </span>
      <span onClick={stop} onKeyDown={stop}>
        <InlineEdit
          kind="date"
          enabled={editable}
          value={o.due_date ?? ""}
          label={`Due date for ${o.title}`}
          display={due ?? "—"}
          className={`text-left text-body-sm tabular-nums ${isOverdue(o) ? "font-semibold text-error-700" : due ? "text-neutral-600" : "text-neutral-300"}`}
          onCommit={(v) => {
            const next = v || null;
            if (next !== o.due_date)
              onSave({ due_date: next }, "Due date saved.");
          }}
        />
      </span>
      <span className="flex justify-end" onClick={stop} onKeyDown={stop}>
        <InlineEdit
          kind="hours"
          enabled={editable}
          value={String(o.hours)}
          label={`Hours for ${o.title}`}
          display={String(o.hours)}
          className="text-right text-body-sm font-semibold tabular-nums text-neutral-700"
          onCommit={(v) => {
            const hours = roundUpToQuarterHour(v);
            if (hours > 0 && hours !== o.hours) {
              onSave(
                { hours },
                `Saved. ${o.accountName}: ${hours} hrs, ${hours * CREDITS_PER_HOUR} credits.`,
              );
            }
          }}
        />
      </span>
      <span className="text-right text-body-sm tabular-nums text-neutral-700">
        {o.hours * CREDITS_PER_HOUR}
      </span>
    </div>
  );
}

/** A value that turns into an input on click and saves on Enter or blur; Escape cancels. */
function InlineEdit({
  kind,
  enabled,
  value,
  display,
  label,
  className,
  onCommit,
}: {
  kind: "hours" | "date";
  enabled: boolean;
  value: string;
  display: string;
  label: string;
  className: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Enter saves and unmounts the input, which can blur it too: commit once.
  const finished = useRef(false);

  if (!enabled) return <span className={className}>{display}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        title="Click to edit"
        aria-label={`${label}: ${display}. Edit`}
        onClick={() => {
          setDraft(value);
          finished.current = false;
          setEditing(true);
        }}
        className={cn(
          "-mx-1.5 rounded px-1.5 py-1 hover:bg-secondary-50 hover:ring-1 hover:ring-secondary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
          className,
        )}
      >
        {display}
      </button>
    );
  }

  const finish = (commit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    if (commit) onCommit(draft);
  };

  return (
    <input
      autoFocus
      aria-label={label}
      type={kind === "hours" ? "number" : "date"}
      min={kind === "hours" ? "0.25" : undefined}
      step={kind === "hours" ? "0.25" : undefined}
      inputMode={kind === "hours" ? "decimal" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      className={cn(
        "h-8 rounded-md border border-secondary-500 bg-white px-2 text-body-sm tabular-nums text-neutral-800 outline-none ring-2 ring-secondary-500/40",
        kind === "hours" ? "w-[64px] text-right" : "w-[132px]",
      )}
    />
  );
}
