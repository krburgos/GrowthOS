import { cn } from "@/lib/utils";

/**
 * Client-confirmed color direction (2026-09-17), "Concept B — navy command
 * bar" from the approved mockup: the page's identity and headline numbers
 * share one navy→teal band at the top, and everything below it stays white
 * and quiet. Gradient is built from Design System §9 tokens only
 * (primary-900 → primary-700 → secondary-800); the band is the one heavy
 * block of color on a page, so it's never repeated further down.
 */
export function HeroBand({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl p-4 text-white md:p-5",
        "bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]",
        className
      )}
    >
      {children}
    </section>
  );
}

/**
 * The button style for an action sitting inside a HeroBand. Exported so a
 * dialog that renders its own trigger can match the buttons beside it.
 */
export const HERO_ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-body-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300";

/** Small uppercase label used above a group inside the band. */
export function HeroLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-white/55">{children}</p>;
}
