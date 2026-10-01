import type { ReactNode } from "react";

/**
 * A heading that divides one band of a page from the next (client-confirmed,
 * 2026-09-22, to separate the Command Center's KPI band from its cards).
 *
 * The Design System is silent on section headings inside a page, so this
 * fills the gap rather than overriding a decision: a navy title behind a
 * short cyan mark, then a hairline running to whatever the section keeps on
 * its right - a count, a live badge, a control. The rule does the dividing,
 * so a section needs no box drawn around it and no tinted ground.
 *
 * Note the title's classes are written as one string rather than passed
 * through cn(): tailwind-merge does not recognise this project's custom type
 * scale as font sizes, so cn("text-h3", "text-primary-900") would drop the
 * size. See the comment on cn() in lib/utils.ts.
 */
export function SectionHeading({
  title,
  children,
  tone = "light",
}: {
  title: string;
  children?: ReactNode;
  /**
   * The ground this heading sits on, matching HeroLabel's prop of the same
   * name. Added 2026-10-01 when the Mission Cards section gained a navy
   * panel: the KPI band still uses this heading on white, so recolouring it
   * outright would have inverted that one.
   */
  tone?: "light" | "dark";
}) {
  const onDark = tone === "dark";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h2
        className={`inline-flex shrink-0 items-center gap-2 text-h3 ${onDark ? "text-white" : "text-primary-900"}`}
      >
        <span
          aria-hidden="true"
          className={`h-[1.1em] w-[3px] shrink-0 rounded-full ${onDark ? "bg-secondary-400" : "bg-secondary-500"}`}
        />
        {title}
      </h2>
      <span aria-hidden="true" className={`h-px min-w-6 flex-1 ${onDark ? "bg-white/20" : "bg-neutral-200"}`} />
      {children ? <div className="flex shrink-0 items-center gap-3">{children}</div> : null}
    </div>
  );
}
