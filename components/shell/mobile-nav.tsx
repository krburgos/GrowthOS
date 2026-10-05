"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * The phone/tablet navigation drawer's open state (client-confirmed,
 * 2026-10-05).
 *
 * Below `lg` the sidebar stops being a column in the layout and becomes an
 * off-canvas drawer, so the button that opens it (in the top bar) and the
 * drawer itself (rendered by Sidebar) are in different subtrees. This
 * context is the smallest thing that can join them — the alternative was
 * lifting both into one component, which would mean the top bar owning the
 * navigation markup.
 *
 * Why a drawer rather than auto-collapsing to the 64px rail: on a 390px
 * screen even the rail is 16% of the width, and the rail's labels are
 * hover-only tooltips, which touch has no equivalent for. A drawer gives
 * the content the whole screen and keeps real text labels.
 */
interface MobileNavState {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

const MobileNavContext = createContext<MobileNavState | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);

  // Navigating is the drawer's whole purpose, so arriving somewhere closes
  // it. Keyed on the path rather than on the link's own click so it also
  // closes on a back/forward navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    // Stop the page behind the drawer scrolling under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, close }}>{children}</MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavState {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used inside MobileNavProvider");
  }
  return context;
}

/**
 * The hamburger, shown only below `lg` — above it the sidebar is a real
 * column and needs no trigger.
 */
export function MobileNavTrigger() {
  const { open, setOpen } = useMobileNav();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open navigation"
      aria-expanded={open}
      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-800 transition-colors hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 lg:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}
