"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_HOURS,
  DEFAULT_MAPPING,
  currentQuarter,
  type KpiBoxKey,
  type StepHours,
} from "@/lib/gos-dashboard/hours-mockup";

type CardStyle = "stack" | "ledger";

interface MockupState {
  hours: Record<string, StepHours>;
  mapping: Record<KpiBoxKey, string[]>;
  cardStyle: CardStyle;
  icpWritten: boolean;
}

interface MockupContextValue extends MockupState {
  quarter: ReturnType<typeof currentQuarter>;
  setHours: (slug: string, hours: StepHours) => void;
  setMapping: (mapping: Record<KpiBoxKey, string[]>) => void;
  setCardStyle: (style: CardStyle) => void;
  setIcpWritten: (value: boolean) => void;
  reset: () => void;
}

const STORAGE_KEY = "gos-dashboard-mockup-v1";

const DEFAULTS: MockupState = {
  hours: DEFAULT_HOURS,
  mapping: DEFAULT_MAPPING,
  cardStyle: "stack",
  icpWritten: true,
};

const MockupContext = createContext<MockupContextValue | null>(null);

/** Branch-only mockup state, persisted to localStorage so edits survive navigating into a step and back. */
export function MockupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MockupState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<MockupState>) });
    } catch {
      // Unreadable storage just means the sample defaults stay in place.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / blocked storage: edits still work for this page view.
    }
  }, [state, loaded]);

  const setHours = useCallback(
    (slug: string, hours: StepHours) => setState((s) => ({ ...s, hours: { ...s.hours, [slug]: hours } })),
    []
  );
  const setMapping = useCallback((mapping: Record<KpiBoxKey, string[]>) => setState((s) => ({ ...s, mapping })), []);
  const setCardStyle = useCallback((cardStyle: CardStyle) => setState((s) => ({ ...s, cardStyle })), []);
  const setIcpWritten = useCallback((icpWritten: boolean) => setState((s) => ({ ...s, icpWritten })), []);
  const reset = useCallback(() => setState(DEFAULTS), []);

  const value = useMemo(
    () => ({ ...state, quarter: currentQuarter(), setHours, setMapping, setCardStyle, setIcpWritten, reset }),
    [state, setHours, setMapping, setCardStyle, setIcpWritten, reset]
  );

  return <MockupContext.Provider value={value}>{children}</MockupContext.Provider>;
}

export function useMockup() {
  const ctx = useContext(MockupContext);
  if (!ctx) throw new Error("useMockup must be used inside MockupProvider");
  return ctx;
}
