import { Building2, ClipboardList, Compass } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { KpiBandHero } from "@/components/dashboard/kpi-band-hero";
import { HoursTotalsStrip } from "@/components/gos-dashboard/hours-totals-strip";
import { HeroLabel } from "@/components/shell/hero-band";
import { formatAddress, initials, profileCompleteness, type CompanyProfile } from "@/lib/accounts/company-profile";
import type { QuarterInfo, StepHours } from "@/lib/gos-dashboard/hours";
import type { KpiSource } from "@/lib/gos-dashboard/kpi-band";
import { QUESTIONNAIRE_SECTIONS } from "@/lib/questionnaire/questions";
import { VISION_BOARD_SECTIONS } from "@/lib/vision-board/sections";

/**
 * The Dashboard's setup-and-performance block (client-confirmed, 2026-09-24,
 * approved mockups "A" then v5).
 *
 * Three panels say *what still needs doing* — Company Profile, Solution
 * Questionnaire, Vision Board — and beneath them, separated by a hairline
 * rather than a gap, workstream hours and the KPI Dashboard say *how things
 * are going*. One navy container rather than cards above a band, so the two
 * halves read as one object.
 *
 * Navy rather than white cards: on white, amber had to compete with body
 * text, navy headings and teal links. Here nothing else is warm, so amber
 * reads as "this needs you" at a glance and green as "handled" — which is
 * what lets status drive the design rather than decorate it. An unfinished
 * panel takes an amber rule, an amber figure, a status pill and a solid
 * button; a finished one goes quiet. That is also where the nudge lives:
 * the two full-width banners are gone, so nothing needs dismissing.
 *
 * Two things this version fixes:
 *
 * - **The Company Profile panel reports rather than repeats.** It used to
 *   print the address, phone, links, CEO and the whole team, which was the
 *   tallest thing in the block and pushed the hours and KPI band below the
 *   fold. All of it lives on Settings › Company, which is the only place it
 *   can be edited anyway; here it shows identity, a completeness score and
 *   the fields still missing. The whole block now fits one screen.
 * - **Every panel is built to the same three slots** — identity, then the
 *   figure and its bar, then the detail — at fixed heights, so the bars sit
 *   on one line across the row. Previously the profile's logo row pushed
 *   its bar ~40px below the other two. Fixed rather than natural heights,
 *   so the alignment holds for a long company name, a missing logo, or six
 *   missing fields instead of two.
 *
 * Neither band label mentions the Command Center (client-confirmed), even
 * though the hours strip is that page's headline figure.
 */
export function SetupBlock({
  account,
  canEditProfile,
  questionnaire,
  visionBoard,
  hours,
  quarter,
  kpiSources,
  accountId,
  teamCount,
}: {
  account: CompanyProfile | null;
  canEditProfile: boolean;
  questionnaire: { answered: number; total: number; complete: boolean };
  visionBoard: { answered: number; total: number; complete: boolean; signedBy?: string | null; signedOn?: string | null };
  hours: StepHours[];
  quarter: QuarterInfo;
  kpiSources: KpiSource[];
  accountId: string;
  /** In-house roster size - the eleventh completeness field. */
  teamCount: number;
}) {
  return (
    /* Client-confirmed (2026-09-29, approved mockup "3 — Navy block, white
       cards"). The navy ground is back, and this is deliberately *not* a
       revert to what shipped before 2026-09-28.

       That original had two things at once: a navy block, and translucent
       cards cut into it. Going pale (A1) fixed the cards — they became
       solid white and began reading as raised objects rather than holes —
       but it also removed the navy, and those were separate improvements
       bundled into one change. The feedback, "too white", was about the
       missing navy rather than the cards.

       So the ground returns and the solid white cards stay. That pairing
       has never shipped before, and it carries more contrast than either
       the original or the pale version: a white card on navy separates
       harder than a white card on a tint, and much harder than a
       translucent one on navy.

       Layout is untouched throughout — same three cards, same hours strip,
       same KPI band, same order. */
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl p-4 shadow-lift md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]">
      {/* The cyan rule survives the move to navy — it is the one place the
          accent colour appears on the block itself. A child span rather
          than a border-top, so nothing else can win the colour. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-secondary-500" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {account && <CompanyPanel account={account} canEdit={canEditProfile} teamCount={teamCount} />}

        <DocumentPanel
          title="Solution Questionnaire"
          subject="Ideal Client Profile"
          sections={QUESTIONNAIRE_SECTIONS.length}
          icon={<ClipboardList className="size-4" />}
          answered={questionnaire.answered}
          total={questionnaire.total}
          complete={questionnaire.complete}
          href="/settings/growth-questionnaire"
          startLabel="Start"
          detailLabel={questionnaire.complete ? "Where it is used" : "Why it matters"}
          detail={
            questionnaire.complete
              ? "Your ICP is set, and the workstream readiness check reads it."
              : "The rest of GrowthOS reads your ICP from this. Start here."
          }
        />

        <DocumentPanel
          title="Vision Board"
          subject="Strategy & Vision"
          sections={VISION_BOARD_SECTIONS.length}
          icon={<Compass className="size-4" />}
          answered={visionBoard.answered}
          total={visionBoard.total}
          complete={visionBoard.complete}
          href={visionBoard.complete ? "/vision-board" : "/settings/vision-board"}
          startLabel="Start"
          detailLabel={visionBoard.complete && visionBoard.signedBy ? "Signed off" : "What it covers"}
          detail={
            visionBoard.complete && visionBoard.signedBy
              ? [visionBoard.signedBy, visionBoard.signedOn].filter(Boolean).join(" · ")
              : "Ten-year target, core values, the three-year picture and this year's plan."
          }
        />
      </div>

      <div className="h-px bg-white/18" />

      {/* Section labels go back to the dark tone the Command Center uses.
          The strip takes "raised" rather than plain "card": on navy the
          card variant's light border adds nothing, and its shadow — tuned
          for pale grounds — is invisible. */}
      <div>
        <HeroLabel>
          Workstream hours · {quarter.label} · {quarter.range}
        </HeroLabel>
        <HoursTotalsStrip hours={hours} quarter={quarter} variant="raised" />
      </div>

      <div>
        <HeroLabel>KPI Dashboard</HeroLabel>
        <KpiBandHero accountId={accountId} sources={kpiSources} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * The three slots that hold the row in line. Fixed heights, not natural
 * ones: a panel with nothing to put in a slot leaves it empty rather than
 * collapsing it, which is what keeps the bars level when one document is
 * complete and another has not been started.
 */
const SLOT_ID = "flex h-10 items-center gap-2.5";
const SLOT_FIG = "h-20 pt-3";
const SLOT_DETAIL = "flex-1 pt-3";

/* On a pale ground the primary action has to be the solid one — the old
   pair was inverted for navy, where white was the loud choice. */
const CTA_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3.5 py-1.5 text-body-sm font-semibold text-white transition-colors hover:bg-primary-800";
const QUIET_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3.5 py-1.5 text-body-sm font-semibold text-primary-900 transition-colors hover:bg-neutral-50";

function Panel({
  title,
  complete,
  status,
  children,
  footNote,
  action,
}: {
  title: string;
  complete: boolean;
  status: string;
  children: ReactNode;
  footNote: string;
  action: ReactNode;
}) {
  return (
    /* No border: on navy, a pale edge round a white card reads as a halo.
       Depth comes from shadow-raised instead. */
    <div className="relative flex flex-col overflow-hidden rounded-xl bg-white shadow-raised">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${complete ? "bg-success-400" : "bg-warning-400"}`} />
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h3 className="flex-1 truncate text-body-sm font-semibold text-primary-900">{title}</h3>
        <span
          /* Client-confirmed (2026-09-25, mockup "C"): the status reads at
             text-h3 rather than text-caption — 18px against the figure's
             28px. Matching the figure exactly was mocked up and rejected:
             the block already carries three rows of numbers at 24–28px, and
             a fourth element at that size flattened the hierarchy instead of
             raising the status. leading-none keeps the pill from inheriting
             h3's 26px line height and growing the header row. */
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-h3 font-bold uppercase leading-none tracking-wide ${
            complete ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-800"
          }`}
        >
          {status}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3">{children}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5">
        <span className="text-caption text-neutral-400">{footNote}</span>
        {action}
      </div>
    </div>
  );
}

function SlotLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-caption font-bold uppercase tracking-widest text-neutral-400">{children}</p>;
}

function Figure({ value, of, complete }: { value: number; of: string; complete: boolean }) {
  /* The 400-weight greens and ambers were chosen to sit on navy. On white
     they fail contrast, so the figure drops to the 700/800 steps. */
  return (
    <p className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${complete ? "text-success-700" : "text-warning-800"}`}>
      {value.toLocaleString()} <span className="text-h4 font-semibold text-neutral-400">/ {of}</span>
    </p>
  );
}

function Meter({ pct, complete }: { pct: number; complete: boolean }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-edge">
      <div
        className={`h-full rounded-full ${complete ? "bg-success-600" : "bg-warning-400"}`}
        style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }}
      />
    </div>
  );
}

/** The 34px plate in the identity slot — the logo, or an icon for a document. */
function Plate({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
      {children}
    </span>
  );
}

function Identity({ plate, title, sub }: { plate: ReactNode; title: string; sub: string }) {
  return (
    <div className={SLOT_ID}>
      {plate}
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-bold leading-tight text-primary-900">{title}</span>
        <span className="block truncate text-caption text-neutral-500">{sub}</span>
      </span>
    </div>
  );
}

function CompanyPanel({ account, canEdit, teamCount }: { account: CompanyProfile; canEdit: boolean; teamCount: number }) {
  const c = profileCompleteness(account, teamCount);
  const address = formatAddress(account);
  const cityLine = [account.address_city, account.address_state].filter(Boolean).join(", ") || address || "No address yet";

  return (
    <Panel
      title="Company Profile"
      complete={c.complete}
      status={c.complete ? "Complete" : `${c.missing.length} to add`}
      footNote="Shown across GrowthOS"
      action={
        canEdit ? (
          <Link href="/settings/company" className={c.complete ? QUIET_CLASS : CTA_CLASS}>
            {c.complete ? "Edit →" : "Complete"}
          </Link>
        ) : null
      }
    >
      <Identity
        plate={
          account.logo_url ? (
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={account.logo_url} alt="" className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <Plate>
              <span className="text-caption font-bold">{initials(account.name)}</span>
            </Plate>
          )
        }
        title={account.name}
        sub={cityLine}
      />

      <div className={SLOT_FIG}>
        <SlotLabel>Profile completeness</SlotLabel>
        <Figure value={c.filled} of={`${c.total} fields`} complete={c.complete} />
        <Meter pct={(c.filled / c.total) * 100} complete={c.complete} />
      </div>

      <div className={SLOT_DETAIL}>
        {c.missing.length > 0 ? (
          <>
            <SlotLabel>Still missing</SlotLabel>
            <ul className="flex flex-wrap gap-1.5">
              {c.missing.map((field) => (
                <li
                  key={field}
                  className="rounded-full border border-dashed border-neutral-300 px-2.5 py-0.5 text-caption font-semibold capitalize text-neutral-600"
                >
                  {field}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <SlotLabel>All set</SlotLabel>
            <p className="text-caption leading-relaxed text-neutral-500">
              Every field is filled in, so the profile reads correctly everywhere it appears.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

function DocumentPanel({
  title,
  subject,
  sections,
  icon,
  answered,
  total,
  complete,
  href,
  startLabel,
  detailLabel,
  detail,
}: {
  title: string;
  /** What the document is *about*, in the identity slot — "Ideal Client Profile". */
  subject: string;
  sections: number;
  icon: ReactNode;
  answered: number;
  total: number;
  complete: boolean;
  href: string;
  startLabel: string;
  detailLabel: string;
  detail: string;
}) {
  const status = complete ? "Complete" : answered === 0 ? "Not started" : "In progress";
  return (
    <Panel
      title={title}
      complete={complete}
      status={status}
      footNote={complete ? "PDF available" : answered === 0 ? "Not started" : `${total - answered} still to answer`}
      action={
        <Link href={href} className={complete ? QUIET_CLASS : CTA_CLASS}>
          {complete ? "View →" : answered === 0 ? startLabel : "Continue"}
        </Link>
      }
    >
      <Identity plate={<Plate>{icon}</Plate>} title={subject} sub={`${sections} sections`} />

      <div className={SLOT_FIG}>
        <SlotLabel>Questions answered</SlotLabel>
        <Figure value={answered} of={String(total)} complete={complete} />
        <Meter pct={(answered / total) * 100} complete={complete} />
      </div>

      <div className={SLOT_DETAIL}>
        <SlotLabel>{detailLabel}</SlotLabel>
        <p className="text-caption leading-relaxed text-neutral-500">{detail}</p>
      </div>
    </Panel>
  );
}
