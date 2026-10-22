"use client";

import { ArrowLeft, Maximize2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One section at a time (client-confirmed, 2026-10-20, approved mockup
 * "Command Center Focus"; extended to every Mission Card 2026-10-22,
 * approved mockup "Mission Card Workspaces" v3). A switcher under the page
 * title shows every section or just one, full width; each section's own
 * header carries a Focus button that does the same.
 *
 * The view lives in the address (each section's `hash`), so Back works and
 * a focused view can be shared or bookmarked, and the last one chosen is
 * remembered in this browser under `storageKey` (one key per page, so each
 * Mission Card keeps its own). Sections stay mounted while hidden, so their
 * filters survive switching.
 */
export interface SwitcherSection {
  view: string;
  label: string;
  /** In the address, e.g. "#mission-orders". */
  hash: string;
  count?: number;
}

const SectionViewContext = createContext<{ view: string; show: (v: string) => void } | null>(null);

/** The current view ("all" or a section's view), or null outside a switcher (Headquarters shares MissionOrders). */
export function useSectionView(): string | null {
  return useContext(SectionViewContext)?.view ?? null;
}

export function SectionSwitcher({
  sections,
  storageKey,
  label,
  children,
}: {
  sections: SwitcherSection[];
  storageKey: string;
  /** Names the tab list for screen readers, e.g. "Command Center sections". */
  label: string;
  children: ReactNode;
}) {
  const [view, setView] = useState("all");

  const viewFromHash = useCallback((hash: string) => sections.find((s) => s.hash === hash)?.view ?? null, [sections]);

  // On arrival: the address wins, then the last view chosen here.
  useEffect(() => {
    const fromHash = viewFromHash(window.location.hash);
    if (fromHash) {
      setView(fromHash);
      return;
    }
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && (saved === "all" || sections.some((s) => s.view === saved))) setView(saved);
    } catch {
      // Storage blocked: start on every section.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = () => setView(viewFromHash(window.location.hash) ?? "all");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [viewFromHash]);

  const show = useCallback(
    (v: string) => {
      setView(v);
      const hash = sections.find((s) => s.view === v)?.hash ?? "";
      const url = window.location.pathname + window.location.search + hash;
      window.history.pushState(null, "", url);
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {
        // Storage blocked: the address still carries the view.
      }
      window.scrollTo({ top: 0 });
    },
    [sections, storageKey]
  );

  const tabs: { view: string; label: string; count?: number }[] = [{ view: "all", label: "All sections" }, ...sections];

  return (
    <SectionViewContext.Provider value={{ view, show }}>
      <div
        role="tablist"
        aria-label={label}
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
export function SectionPane({ view, children }: { view: string; children: ReactNode }) {
  const current = useContext(SectionViewContext)?.view ?? "all";
  return <div hidden={current !== "all" && current !== view}>{children}</div>;
}

/**
 * The ⤢ Focus button in a section's own header; only while every section
 * shows. `tone="light"` for the few section headers that are white rather
 * than navy (AdvocateDash's targets).
 */
export function FocusButton({ view, label, tone = "dark" }: { view: string; label: string; tone?: "dark" | "light" }) {
  const ctx = useContext(SectionViewContext);
  if (!ctx || ctx.view !== "all") return null;
  return (
    <button
      type="button"
      onClick={() => ctx.show(view)}
      aria-label={`Show only ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
        tone === "dark"
          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-secondary-300"
          : "bg-primary-50 text-primary-800 hover:bg-primary-100 focus-visible:ring-secondary-500/40"
      )}
    >
      <Maximize2 className="size-3.5" />
      Focus
    </button>
  );
}
