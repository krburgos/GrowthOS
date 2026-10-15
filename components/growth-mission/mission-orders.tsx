"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronRight, GripVertical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CompleteBox,
  OwnerCell,
  PriorityChip,
  StatePill,
  formatDue,
  isOverdue,
  orderCredits,
} from "@/components/growth-mission/order-bits";
import { OrderPanel, OrderPrompt } from "@/components/growth-mission/order-panel";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { FilterField, FilterResult, FilterTitle, filterTriggerClass } from "@/components/ui/filter-bar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { CREDITS_PER_HOUR } from "@/lib/growth-mission/capacity";
import { SHORT_TITLE, currentQuarter, formatWhole } from "@/lib/growth-mission/hours";
import {
  PRIORITIES,
  PRIORITY_CHIP,
  PRIORITY_LABEL,
  PRIORITY_MEANING,
  byPosition,
  canToggleComplete,
  orderType,
  rankOrders,
  type Task,
  type TaskPriority,
} from "@/lib/growth-mission/tasks";
import { createClient } from "@/lib/supabase/client";
import type { TeamMember } from "@/lib/team/members";

type Due = "" | "late" | "week" | "month" | "quarter";
const ANY = "__any__";

const DUE_OPTIONS: { value: Due; label: string }[] = [
  { value: "", label: "Any due date" },
  { value: "late", label: "Overdue" },
  { value: "week", label: "Due in 7 days" },
  { value: "month", label: "Due this month" },
  { value: "quarter", label: "Due this quarter" },
];

/** Local calendar date as YYYY-MM-DD, the shape due_date is stored in. */
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function matchesDue(task: Task, due: Due): boolean {
  if (!due) return true;
  if (due === "late") return isOverdue(task);
  if (!task.due_date) return false;
  const now = new Date();
  const today = isoDay(now);
  if (due === "week") {
    const inAWeek = new Date(now);
    inAWeek.setDate(now.getDate() + 7);
    return task.due_date >= today && task.due_date <= isoDay(inAWeek);
  }
  if (due === "month") {
    return task.due_date >= today && task.due_date <= isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }
  const q = currentQuarter();
  return task.due_date >= q.start && task.due_date <= q.end;
}

/**
 * Mission Orders – Tasks/Tickets (client-confirmed, 2026-10-14, approved
 * mockup "Mission Orders Design"). One table in three places:
 *
 * - `discipline` — a discipline page's orders, replacing "What to do
 *   next". Rows open the order panel, and dragging a row within its tier
 *   renumbers that tier.
 * - `overview` — every discipline's orders, below the Mission Cards on the
 *   Command Center and below Opportunities by Stage on Headquarters. A row
 *   opens a prompt that leads to its Mission Card.
 *
 * Priority is ABC-123 labelled Must / Should / Could. The number in
 * "Must 2" is the order's position in its tier within its discipline
 * (rankOrders), never typed, so it can't duplicate or skip.
 *
 * Every row's checkbox works in place. A GrowthMission order's is locked
 * for everyone but CRO Leader, because completing it spends credits.
 */
export function MissionOrders({
  mode,
  accountId,
  slug,
  orders,
  team,
  memberLoad = {},
  canEdit,
  isCroLeader,
  openOrderId,
  initialPriorities,
  hideCompleted = false,
}: {
  mode: "discipline" | "overview";
  accountId: string;
  /** Discipline mode: the discipline new orders are issued into. */
  slug?: string;
  orders: Task[];
  team: TeamMember[];
  /** Unfinished hours per person across every discipline, for the owner picker. */
  memberLoad?: Record<string, number>;
  /** MSP Owner/Admin and CRO Admin/Advisor. RLS is the control; this decides what is drawn. */
  canEdit: boolean;
  isCroLeader: boolean;
  /** Discipline mode: open this order's panel on arrival (?order=). */
  openOrderId?: string;
  /**
   * Which tiers are ticked on arrival. Headquarters opens on Must only
   * (client-confirmed, 2026-10-15); everywhere else shows all three.
   */
  initialPriorities?: TaskPriority[];
  /**
   * Leave completed orders out entirely. Headquarters lists them in the
   * Mission Orders Archive right below (client-confirmed, 2026-10-15), so
   * its "Show completed" row would show them twice.
   */
  hideCompleted?: boolean;
}) {
  const router = useRouter();
  const overview = mode === "overview";

  // A local copy, so a tick or a drag lands the moment it happens rather
  // than after a server round trip.
  const [rows, setRows] = useState(orders);
  useEffect(() => setRows(orders), [orders]);

  const [pri, setPri] = useState<Record<TaskPriority, boolean>>(() =>
    initialPriorities
      ? { high: initialPriorities.includes("high"), medium: initialPriorities.includes("medium"), low: initialPriorities.includes("low") }
      : { high: true, medium: true, low: true }
  );
  const [owner, setOwner] = useState<string>("");
  const [disc, setDisc] = useState<string>("");
  const [due, setDue] = useState<Due>("");
  const [showDone, setShowDone] = useState(false);
  // Overview only: which tiers are showing every order rather than the top few.
  const [expanded, setExpanded] = useState<Record<TaskPriority, boolean>>({ high: false, medium: false, low: false });

  const [panel, setPanel] = useState<{ task: Task | null; priority?: TaskPriority } | null>(null);
  const [prompt, setPrompt] = useState<Task | null>(null);

  useEffect(() => {
    if (!openOrderId) return;
    const t = orders.find((o) => o.id === openOrderId);
    if (t) setPanel({ task: t });
    // Only on arrival: later refreshes must not reopen a panel someone closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOrderId]);

  const rank = useMemo(() => rankOrders(rows), [rows]);

  const filtered = !pri.high || !pri.medium || !pri.low || owner !== "" || disc !== "" || due !== "";
  const visible = rows.filter((t) => {
    if (!pri[t.priority]) return false;
    if (disc && t.step_slug !== disc) return false;
    if (owner === "growthmission" && !t.delegated) return false;
    if (owner === "unassigned" && orderType(t) !== null) return false;
    if (owner && owner !== "growthmission" && owner !== "unassigned" && t.assignee?.id !== owner) return false;
    return matchesDue(t, due);
  });

  const discName = (s: string) => SHORT_TITLE[s] ?? s;
  // Inside a tier: its number, then (overview only) the discipline's name.
  const inTier = (a: Task, b: Task) =>
    (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) ||
    discName(a.step_slug).localeCompare(discName(b.step_slug)) ||
    byPosition(a, b);

  const open = visible.filter((t) => t.state !== "complete");
  const done = visible
    .filter((t) => t.state === "complete")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  // Dragging only makes sense on one discipline with nothing hidden: the
  // new order is written for the whole tier.
  const draggable = !overview && canEdit && !filtered;

  const patch = async (task: Task, values: Partial<Task>) => {
    setRows((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...values } : t)));
    const { error } = await createClient().from("growth_mission_tasks").update(values).eq("id", task.id);
    if (error) {
      setRows((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    if (task.delegated && values.state) {
      const credits = task.hours * CREDITS_PER_HOUR;
      toast.success(values.state === "complete" ? `Confirmed complete. ${credits} credits used.` : `Reopened. ${credits} credits returned.`);
    }
    router.refresh();
  };

  const toggle = (task: Task) => void patch(task, { state: task.state === "complete" ? "active" : "complete" });

  const reorder = async (tier: Task[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tier.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const before = rows;
    const position = new Map(next.map((id, i) => [id, i + 1]));
    setRows((prev) => prev.map((t) => (position.has(t.id) ? { ...t, sort_order: position.get(t.id)! } : t)));
    const { error } = await createClient().rpc("reorder_mission_orders", { p_ids: next });
    if (error) {
      setRows(before);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    router.refresh();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } })
  );

  const openRow = (task: Task) => (overview ? setPrompt(task) : setPanel({ task }));

  const sum = (list: Task[]) => list.reduce((s, t) => s + t.hours, 0);
  const openAll = rows.filter((t) => t.state !== "complete");
  const delegatedOpen = openAll.filter((t) => t.delegated);

  const cols = overview ? OVERVIEW_COLS : DISCIPLINE_COLS;
  const rowProps = { cols, overview, draggable, rank, canEdit, isCroLeader, onOpen: openRow, onToggle: toggle };

  const clear = () => {
    setPri({ high: true, medium: true, low: true });
    setOwner("");
    setDisc("");
    setDue("");
  };

  const disciplines = overview ? Array.from(new Set(rows.map((t) => t.step_slug))).sort((a, b) => discName(a).localeCompare(discName(b))) : [];

  return (
    // Client-confirmed (2026-10-14, "Mission Orders Blue" A): a blue frame —
    // navy title bar, light blue filters and column headings, blue footer —
    // with the rows left white so the orders stay easiest to read.
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">Mission Orders – Tasks/Tickets</h2>
          <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
            {rows.length === 0
              ? "No mission orders yet."
              : `${openAll.length} open · ${formatWhole(sum(openAll))} hrs${overview ? " across every Mission Card" : ""} · ${delegatedOpen.length} with GrowthMission`}
          </p>
        </div>
        {!overview && canEdit && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto border-transparent hover:border-transparent"
            onClick={() => setPanel({ task: null })}
          >
            <Plus className="mr-1.5 size-4" />
            Issue order
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          {overview
            ? "No mission orders yet. Open a Mission Card to issue the first one."
            : canEdit
              ? "Issue the first order once the report says what needs doing."
              : "CRO Leader hasn't issued any mission orders for this Mission Card yet."}
        </p>
      ) : (
        <>
          {/* Client-confirmed (2026-10-15, approved mockup "Table Filters"):
              the row says it is a filter, every control is named, the
              Priority pills carry a tick box (ticked = that tier is shown),
              and a filtered table says how many it is showing. Clear shows
              everything again, including on Headquarters, which opens on Must. */}
          <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
            <FilterTitle />
            <FilterField label="Priority" tone="blue">
              <div className="flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={pri[p]}
                    title={`${PRIORITY_MEANING[p]}. ${pri[p] ? "Shown: click to hide." : "Hidden: click to show."}`}
                    onClick={() => setPri((s) => ({ ...s, [p]: !s[p] }))}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 motion-reduce:transition-none ${
                      pri[p] ? `border-transparent ${PRIORITY_CHIP[p]}` : "border-neutral-300 bg-white text-neutral-400"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-3.5 items-center justify-center rounded-[4px] ${pri[p] ? "bg-current" : "border-[1.5px] border-neutral-300"}`}
                    >
                      {pri[p] && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
                    </span>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </FilterField>

            <FilterField label="Owner" tone="blue">
              <Select value={owner || ANY} onValueChange={(v) => setOwner(v === ANY ? "" : v)}>
                <SelectTrigger aria-label="Owner" className={`h-8 w-auto min-w-[150px] text-body-sm ${filterTriggerClass(owner !== "")}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All owners</SelectItem>
                  {(["in_house", "outsourced"] as const).map((kind) => {
                    const people = team.filter((m) => m.kind === kind);
                    return people.length === 0 ? null : (
                      <SelectGroup key={kind}>
                        <SelectLabel>{kind === "in_house" ? "Internal" : "Outsourced"}</SelectLabel>
                        {people.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                  <SelectGroup>
                    <SelectLabel>Credits</SelectLabel>
                    <SelectItem value="growthmission">GrowthMission</SelectItem>
                  </SelectGroup>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            {overview && (
              <FilterField label="Mission Card" tone="blue">
                <Select value={disc || ANY} onValueChange={(v) => setDisc(v === ANY ? "" : v)}>
                  <SelectTrigger aria-label="Mission Card" className={`h-8 w-auto min-w-[160px] text-body-sm ${filterTriggerClass(disc !== "")}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All Mission Cards</SelectItem>
                    {disciplines.map((s) => (
                      <SelectItem key={s} value={s}>
                        {discName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            )}

            <FilterField label="Due" tone="blue">
              <Select value={due || ANY} onValueChange={(v) => setDue(v === ANY ? "" : (v as Due))}>
                <SelectTrigger aria-label="Due" className={`h-8 w-auto min-w-[150px] text-body-sm ${filterTriggerClass(due !== "")}`}>
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

            {filtered && (
              <FilterResult
                shown={hideCompleted ? open.length : visible.length}
                total={hideCompleted ? openAll.length : rows.length}
                noun={hideCompleted ? "open orders" : "orders"}
                onClear={clear}
              />
            )}
          </div>

          {/* Below lg the discipline page keeps one card per order
              (client-confirmed, 2026-10-05). The overview tables scroll
              sideways inside their card instead. */}
          {!overview && (
            <div className="flex flex-col gap-4 px-4 py-4 lg:hidden">
              {PRIORITIES.filter((p) => pri[p]).map((p) => {
                const tier = open.filter((t) => t.priority === p).sort(inTier);
                if (tier.length === 0) return null;
                return (
                  <div key={p} className="flex flex-col gap-2">
                    <TierLabel priority={p} count={tier.length} hours={sum(tier)} />
                    {tier.map((t) => (
                      <OrderCard key={t.id} task={t} {...rowProps} />
                    ))}
                  </div>
                );
              })}
              {done.length > 0 && (
                <>
                  <DoneToggle count={done.length} open={showDone} onToggle={() => setShowDone((v) => !v)} />
                  {showDone && done.map((t) => <OrderCard key={t.id} task={t} {...rowProps} />)}
                </>
              )}
              {visible.length === 0 && <NoMatch onClear={clear} />}
            </div>
          )}

          <div className={`${overview ? "block" : "hidden lg:block"} overflow-x-auto`}>
            <div className={overview ? "min-w-[1080px]" : "min-w-[960px]"}>
              <div className={`${cols} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                {/* No complete column on the overviews (client-confirmed,
                    2026-10-15): orders are completed on their Mission Card. */}
                {!overview && <span />}
                {overview ? <span>Priority</span> : <><span /><span className="text-center">#</span></>}
                <span>Mission Order</span>
                {overview && <span>Mission Card</span>}
                <span>Owner</span>
                <span>Status</span>
                <span>Due</span>
                <span className="text-right">Hrs</span>
                <span className="text-right">Credits</span>
              </div>

              {PRIORITIES.filter((p) => pri[p]).map((p) => {
                const tier = open.filter((t) => t.priority === p).sort(inTier);
                if (tier.length === 0) return null;
                return (
                  <div key={p}>
                    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-white px-5 pb-1.5 pt-3">
                      <TierLabel priority={p} count={tier.length} hours={sum(tier)} />
                      {!overview && canEdit && (
                        <button
                          type="button"
                          onClick={() => setPanel({ task: null, priority: p })}
                          className="ml-auto rounded px-1.5 py-0.5 text-caption font-semibold text-secondary-700 hover:text-secondary-800"
                        >
                          + Add to {PRIORITY_LABEL[p]}
                        </button>
                      )}
                    </div>
                    {draggable ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void reorder(tier, e)}>
                        <SortableContext items={tier.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          {tier.map((t) => (
                            <SortableRow key={t.id} task={t} {...rowProps} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      (overview && !expanded[p] ? tier.slice(0, OVERVIEW_TIER_LIMIT) : tier).map((t) => (
                        <OrderRow key={t.id} task={t} {...rowProps} />
                      ))
                    )}
                    {overview && tier.length > OVERVIEW_TIER_LIMIT && (
                      <button
                        type="button"
                        aria-expanded={expanded[p]}
                        onClick={() => setExpanded((s) => ({ ...s, [p]: !s[p] }))}
                        className="flex w-full items-center gap-2 border-b border-neutral-100 bg-white px-5 py-2.5 text-left text-body-sm font-semibold text-secondary-700 hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40"
                      >
                        {expanded[p] ? (
                          "Show fewer"
                        ) : (
                          <>
                            Show all {tier.length} {PRIORITY_LABEL[p]} orders
                            <span className="font-normal text-neutral-400">· {tier.length - OVERVIEW_TIER_LIMIT} more</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}

              {!hideCompleted && done.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDone((v) => !v)}
                    aria-expanded={showDone}
                    className="flex w-full items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-left text-body-sm text-neutral-500 hover:text-primary-900"
                  >
                    <ChevronRight
                      className={`size-3.5 transition-transform motion-reduce:transition-none ${showDone ? "rotate-90" : ""}`}
                    />
                    <span className="font-semibold">
                      {showDone ? "Hide" : "Show"} completed ({done.length})
                    </span>
                  </button>
                  {showDone && done.map((t) => <OrderRow key={t.id} task={t} {...rowProps} />)}
                </>
              )}

              {visible.length === 0 && <NoMatch onClear={clear} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-primary-200 bg-primary-100 px-5 py-2.5 text-caption tabular-nums text-primary-700">
            <span>
              Internal <b className="font-semibold text-primary-900">{formatWhole(sum(openAll.filter((t) => orderType(t) === "internal")))} hrs</b>
            </span>
            <span>
              Outsourced <b className="font-semibold text-primary-900">{formatWhole(sum(openAll.filter((t) => orderType(t) === "outsourced")))} hrs</b>
            </span>
            <span>
              GrowthMission{" "}
              <b className="font-semibold text-primary-900">
                {formatWhole(sum(delegatedOpen))} hrs · {formatWhole(sum(delegatedOpen) * CREDITS_PER_HOUR)} credits
              </b>
            </span>
          </div>
        </>
      )}

      {panel && (
        <OrderPanel
          accountId={accountId}
          slug={panel.task?.step_slug ?? slug ?? ""}
          task={panel.task}
          rank={panel.task ? rank.get(panel.task.id) : undefined}
          initialPriority={panel.priority}
          team={team}
          memberLoad={memberLoad}
          canEdit={canEdit}
          isCroLeader={isCroLeader}
          onClose={() => setPanel(null)}
        />
      )}
      {prompt && <OrderPrompt task={prompt} rank={rank.get(prompt.id)} onClose={() => setPrompt(null)} />}
    </section>
  );
}

/**
 * Headquarters and the Command Center show this many open orders per tier
 * before "Show all" (client-confirmed, 2026-10-14, "Mission Orders Paging"
 * A). Per tier rather than page numbers, so Must, Should and Could all stay
 * in view and a tier is never split across pages. A Mission Card shows
 * every order, because dragging needs the whole tier on screen.
 */
const OVERVIEW_TIER_LIMIT = 5;

/** One column definition each, shared by the header and the rows. */
const DISCIPLINE_COLS = "grid grid-cols-[28px_18px_36px_minmax(220px,1fr)_190px_118px_72px_48px_64px] items-center gap-x-3";
const OVERVIEW_COLS = "grid grid-cols-[76px_minmax(220px,1fr)_170px_190px_118px_72px_48px_64px] items-center gap-x-3";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";

interface RowProps {
  task: Task;
  cols: string;
  overview: boolean;
  draggable: boolean;
  rank: Map<string, number>;
  canEdit: boolean;
  isCroLeader: boolean;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
}

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <OrderRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      grip={
        <button
          type="button"
          aria-label={`Drag to reorder ${props.task.title}`}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          className="flex cursor-grab touch-none items-center justify-center rounded text-neutral-300 hover:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      }
    />
  );
}

function OrderRow({
  task,
  cols,
  overview,
  rank,
  canEdit,
  isCroLeader,
  onOpen,
  onToggle,
  rowRef,
  style,
  dragging,
  grip,
}: RowProps & {
  rowRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
  grip?: React.ReactNode;
}) {
  const done = task.state === "complete";
  const credits = orderCredits(task);
  const due = formatDue(task.due_date);
  const n = rank.get(task.id);

  return (
    <div
      ref={rowRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}${overview ? " — open its Mission Card" : " — open the order"}`}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={`${cols} min-h-[54px] cursor-pointer border-b border-neutral-100 px-5 py-2 hover:bg-neutral-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40 ${
        dragging ? "relative z-10 bg-white shadow-lift" : "bg-white"
      }`}
    >
      {!overview && (
        <CompleteBox task={task} canToggle={canToggleComplete(task, { canEdit, isCroLeader })} onToggle={() => onToggle(task)} />
      )}
      {overview ? (
        <span>
          <PriorityChip task={task} rank={n} />
        </span>
      ) : (
        <>
          <span className="flex justify-center">{grip}</span>
          <span className="text-center text-body-sm font-bold tabular-nums text-neutral-600">{done ? "" : n}</span>
        </>
      )}
      <span className="min-w-0">
        <span
          className={`block truncate text-body-sm font-semibold ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
          title={task.title}
        >
          {task.title}
        </span>
        {task.detail && (
          <span className="block truncate text-caption text-neutral-500" title={task.detail}>
            {task.detail}
          </span>
        )}
      </span>
      {/* Styled like the order's own title (client-confirmed, 2026-10-15). */}
      {overview && (
        <span className="truncate text-body-sm font-semibold text-neutral-900">{SHORT_TITLE[task.step_slug] ?? task.step_slug}</span>
      )}
      <OwnerCell task={task} />
      <span>
        <StatePill state={task.state} />
      </span>
      <span className={`text-body-sm tabular-nums ${isOverdue(task) ? "font-semibold text-error-700" : due ? "text-neutral-600" : "text-neutral-300"}`}>
        {due ?? "—"}
      </span>
      <span className="text-right text-body-sm font-semibold tabular-nums text-neutral-700">{task.hours}</span>
      <span className={`text-right text-body-sm tabular-nums ${credits !== null ? "text-neutral-700" : "text-neutral-300"}`}>
        {credits ?? "—"}
      </span>
    </div>
  );
}

function OrderCard({ task, rank, canEdit, isCroLeader, onOpen, onToggle }: RowProps) {
  const done = task.state === "complete";
  const credits = orderCredits(task);
  const due = formatDue(task.due_date);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <CompleteBox
            task={task}
            size="lg"
            canToggle={canToggleComplete(task, { canEdit, isCroLeader })}
            onToggle={() => onToggle(task)}
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-body font-medium leading-snug ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
            {task.title}
          </h3>
          {task.detail && <p className="mt-0.5 text-caption text-neutral-500">{task.detail}</p>}
        </div>
        <PriorityChip task={task} rank={rank.get(task.id)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-caption tabular-nums text-neutral-500">
        <OwnerCell task={task} />
        <StatePill state={task.state} />
        <span>{task.hours} hrs</span>
        {credits !== null && <span>{credits} credits</span>}
        {due && <span className={isOverdue(task) ? "font-semibold text-error-700" : ""}>Due {due}</span>}
      </div>
    </article>
  );
}

function TierLabel({ priority, count, hours }: { priority: TaskPriority; count: number; hours: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`inline-flex h-6 items-center rounded-md px-2 text-caption font-bold ${PRIORITY_CHIP[priority]}`}>
        {PRIORITY_LABEL[priority]}
      </span>
      <span className="text-body-sm font-semibold text-primary-900">{PRIORITY_MEANING[priority]}</span>
      <span className="text-caption tabular-nums text-neutral-500">
        {count} {count === 1 ? "order" : "orders"} · {formatWhole(hours)} hrs
      </span>
    </span>
  );
}

function DoneToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-left text-body-sm text-neutral-500"
    >
      <ChevronRight className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
      <span className="font-semibold">
        {open ? "Hide" : "Show"} completed ({count})
      </span>
    </button>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <p className="px-5 py-8 text-center text-body-sm text-neutral-500">
      No mission orders match these filters.{" "}
      <button type="button" onClick={onClear} className="font-semibold text-secondary-700 hover:text-secondary-800">
        Clear filters
      </button>
    </p>
  );
}
