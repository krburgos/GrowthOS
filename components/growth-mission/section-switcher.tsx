"use client";

import { ArrowLeft, Maximize2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Command Center, one section at a time (client-confirmed, 2026-10-20,
 * approved mockup "Command Center Focus"). A switcher under the page title
 * shows every section or just one, full width; each section's own header
 * carries a Focus button that does the same.
 *
 * The view lives in the address (#mission-orders, …), so Back works and a
 * focused view can be shared or bookmarked, and the last one chosen is
 * remembered in this browser. Sections stay mounted while hidden, so their
 * filters survive switching.
 */
export type SectionView = "all" | "capacity" | "progress" | "cards" | "orders";

const HASH: Record<Exclude<SectionView, "all">, string> = {
  capacity: "#mission-capacity",
  progress: "#mission-progress",
  cards: "#mission-cards",
  orders: "#mission-orders",
};
const STORAGE_KEY = "growthmission.commandCenter.view";

function viewFromHash(hash: string): SectionView | null {
  const found = (Object.keys(HASH) as (keyof typeof HASH)[]).find((k) => HASH[k] === hash);
  return found ?? null;
}

const SectionViewContext = createContext<{ view: SectionView; show: (v: SectionView) => void } | null>(null);

/** The current view, or null outside the Command Center (Headquarters shares MissionOrders). */
export function useSectionView(): SectionView | null {
  return useContext(SectionViewContext)?.view ?? null;
}

export function SectionSwitcher({
  sections,
  children,
}: {
  sections: { view: Exclude<SectionView, "all">; label: string; count?: number }[];
  children: ReactNode;
}) {
  const [view, setView] = useState<SectionView>("all");

  // On arrival: the address wins, then the last view chosen here.
  useEffect(() => {
    const fromHash = viewFromHash(window.location.hash);
    if (fromHash) {
      setView(fromHash);
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as SectionView | null;
      if (saved && (saved === "all" || saved in HASH)) setView(saved);
    } catch {
      // Storage blocked: start on every section.
    }
  }, []);

  useEffect(() => {
    const onPop = () => setView(viewFromHash(window.location.hash) ?? "all");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const show = useCallback((v: SectionView) => {
    setView(v);
    const url = window.location.pathname + window.location.search + (v === "all" ? "" : HASH[v]);
    window.history.pushState(null, "", url);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // Storage blocked: the address still carries the view.
    }
    window.scrollTo({ top: 0 });
  }, []);

  const tabs: { view: SectionView; label: string; count?: number }[] = [{ view: "all", label: "All sections" }, ...sections];

  return (
    <SectionViewContext.Provider value={{ view, show }}>
      <div
        role="tablist"
        aria-label="Command Center sections"
        className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lift [scrollbar-width:none]"
      >
        {tabs.map((t) => {
          const on = view === t.view;
          return (
            <button
              key={t.view}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => show(t.view)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 motion-reduce:transition-none",
                on ? "bg-primary-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-primary-900"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-caption font-semibold tabular-nums",
                    on ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view !== "all" && (
        <button
          type="button"
          onClick={() => show("all")}
          className="inline-flex items-center gap-1.5 self-start text-body-sm font-semibold text-secondary-700 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          All sections
        </button>
      )}

      {children}
    </SectionViewContext.Provider>
  );
}

/** One section; hidden (but kept mounted) while another is focused. */
export function SectionPane({ view, children }: { view: Exclude<SectionView, "all">; children: ReactNode }) {
  const current = useContext(SectionViewContext)?.view ?? "all";
  return <div hidden={current !== "all" && current !== view}>{children}</div>;
}

/** The ⤢ Focus button in a section's own header; only while every section shows. */
export function FocusButton({ view, label }: { view: Exclude<SectionView, "all">; label: string }) {
  const ctx = useContext(SectionViewContext);
  if (!ctx || ctx.view !== "all") return null;
  return (
    <button
      type="button"
      onClick={() => ctx.show(view)}
      aria-label={`Show only ${label}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-caption font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
    >
      <Maximize2 className="size-3.5" />
      Focus
    </button>
  );
}
