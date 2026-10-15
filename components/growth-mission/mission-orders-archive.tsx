"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { OwnerCell } from "@/components/growth-mission/order-bits";
import { OrderPrompt } from "@/components/growth-mission/order-panel";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { SHORT_TITLE } from "@/lib/growth-mission/hours";
import { rankOrders, type Task } from "@/lib/growth-mission/tasks";

/** The most recent completed orders shown before "Show all". */
const ARCHIVE_LIMIT = 10;

const COLS = "grid grid-cols-[minmax(280px,1fr)_230px_200px] items-center gap-x-4";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";

/**
 * Mission Orders Archive on Headquarters (client-confirmed, 2026-10-15,
 * approved mockup "Mission Orders Archive"): every completed order across
 * the account, newest completed first, in the same blue frame as Mission
 * Orders directly above it. Only three columns, as the client asked:
 * Mission Order (with its description), Owner and Mission Card.
 *
 * Read-only on purpose. There is no checkbox and no reopening here; a row
 * opens the same "open its Mission Card" prompt the overview rows use, and
 * an order is reopened on its own Mission Card if it ever needs to be.
 */
export function MissionOrdersArchive({ orders }: { orders: Task[] }) {
  const [showAll, setShowAll] = useState(false);
  const [prompt, setPrompt] = useState<Task | null>(null);

  const done = useMemo(
    () =>
      orders
        .filter((t) => t.state === "complete")
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [orders]
  );
  const rank = useMemo(() => rankOrders(orders), [orders]);
  const shown = showAll ? done : done.slice(0, ARCHIVE_LIMIT);

  return (
    <section className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`px-5 py-4 ${NAVY_GRADIENT}`}>
        <h2 className="text-h4 text-white">Mission Orders Archive</h2>
        <p className="mt-0.5 text-body-sm tabular-nums text-secondary-300">
          {done.length === 0 ? "Nothing completed yet." : `${done.length.toLocaleString()} completed · newest first`}
        </p>
      </div>

      {done.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
          Completed mission orders will be listed here.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                <span>Mission Order</span>
                <span>Owner</span>
                <span>Mission Card</span>
              </div>
              {shown.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${task.title} — open its Mission Card`}
                  onClick={() => setPrompt(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPrompt(task);
                    }
                  }}
                  className={`${COLS} min-h-[54px] cursor-pointer border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40`}
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success-100 text-success-800"
                    >
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-semibold text-neutral-900" title={task.title}>
                        {task.title}
                      </span>
                      {task.detail && (
                        <span className="block truncate text-caption text-neutral-500" title={task.detail}>
                          {task.detail}
                        </span>
                      )}
                    </span>
                  </span>
                  <OwnerCell task={task} />
                  <span className="truncate text-body-sm font-semibold text-neutral-900">
                    {SHORT_TITLE[task.step_slug] ?? task.step_slug}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {done.length > ARCHIVE_LIMIT && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="flex w-full items-center gap-2 bg-white px-5 py-2.5 text-left text-body-sm font-semibold text-secondary-700 hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/40"
            >
              {showAll ? (
                "Show fewer"
              ) : (
                <>
                  Show all {done.length.toLocaleString()} completed orders
                  <span className="font-normal text-neutral-400">· {(done.length - ARCHIVE_LIMIT).toLocaleString()} more</span>
                </>
              )}
            </button>
          )}
        </>
      )}

      {prompt && <OrderPrompt task={prompt} rank={rank.get(prompt.id)} onClose={() => setPrompt(null)} />}
    </section>
  );
}
