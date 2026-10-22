"use client";

import { ArrowLeft, Maximize2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One section at a time (client-confirmed, 2026-10-20, approved mockup
 * "Command Center Focus"; extended to every Mission Card 2026-10-22,
 * approved mockup "Mission Card Workspaces" v3). A switcher under the page
 * title shows every section or just one, full width; each section's own
 * header carries a Focus button that does the same.
 *
 * The view goes into the address (each section's `hash`) as you switch, so
 * Back works within a visit. Every page opens on All
 * sections (client-confirmed, 2026-10-22; it used to reopen on the last
 * view chosen), even from a link that names a section. Sections stay mounted
 * while hidden, so their filters survive switching.
 */
export interface SwitcherSection {
  view: string;
  label: string;
  /** In the address, e.g. "#mission-orders". */
  hash: string;
  count?: number;
}

// `switches` counts views chosen by the person (a tab, Focus, Back), not the view restored on arrival.
const SectionViewContext = createContext<{ view: string; show: (v: string) => void; switches: number } | null>(null);

/** The current view ("all" or a section's view), or null outside a switcher (Headquarters shares MissionOrders). */
export function useSectionView(): string | null {
  return useContext(SectionViewContext)?.view ?? null;
}

export function SectionSwitcher({
  sections,
  label,
  children,
}: {
  sections: SwitcherSection[];
  /** Names the tab list for screen readers, e.g. "Command Center sections". */
  label: string;
  children: ReactNode;
}) {
  const [view, setView] = useState("all");
  const [switches, setSwitches] = useState(0);

  const viewFromHash = useCallback((hash: string) => sections.find((s) => s.hash === hash)?.view ?? null, [sections]);

  // On arrival: always All sections, even from a link that names one
  // (client-confirmed, 2026-10-22). The section is dropped from the address
  // so it never claims a view that isn't showing, and the page starts at
  // the top rather than wherever the browser jumped for the anchor.
  useEffect(() => {
    if (!viewFromHash(window.location.hash)) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = () => {
      setView(viewFromHash(window.location.hash) ?? "all");
      setSwitches((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [viewFromHash]);

  const show = useCallback(
    (v: string) => {
      setView(v);
      setSwitches((n) => n + 1);
      const hash = sections.find((s) => s.view === v)?.hash ?? "";
      const url = window.location.pathname + window.location.search + hash;
      window.history.pushState(null, "", url);
      window.scrollTo({ top: 0 });
    },
    [sections]
  );

  const tabs: { view: string; label: string; count?: number }[] = [{ view: "all", label: "All sections" }, ...sections];

  return (
    <SectionViewContext.Provider value={{ view, show, switches }}>
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

/**
 * One section; hidden (but kept mounted) while another is focused. When the
 * view changes it rises into place (Design System §Motion, 2026-10-22). The
 * class is restarted on the same element rather than by remounting, so the
 * section's own state, filters and typing, survives the switch.
 */
export function SectionPane({ view, children }: { view: string; children: ReactNode }) {
  const ctx = useContext(SectionViewContext);
  const current = ctx?.view ?? "all";
  const switches = ctx?.switches ?? 0;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only when the person switches: nothing animates on page load, even
    // when the page reopens on a remembered view.
    if (switches === 0) return;
    const el = ref.current;
    if (!el || el.hidden) return;
    el.classList.remove("animate-rise");
    void el.offsetWidth;
    el.classList.add("animate-rise");
  }, [switches]);
  return (
    <div ref={ref} hidden={current !== "all" && current !== view}>
      {children}
    </div>
  );
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
