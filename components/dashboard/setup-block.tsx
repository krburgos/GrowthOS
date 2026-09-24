import { Building2, ClipboardList, Compass, Globe, Link as LinkIcon, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { KpiBandHero } from "@/components/dashboard/kpi-band-hero";
import { HoursTotalsStrip } from "@/components/gos-dashboard/hours-totals-strip";
import { HeroLabel } from "@/components/shell/hero-band";
import {
  displayUrl,
  externalHref,
  formatAddress,
  initials,
  profileCompleteness,
  type CompanyProfile,
} from "@/lib/accounts/company-profile";
import type { QuarterInfo, StepHours } from "@/lib/gos-dashboard/hours";
import type { KpiSource } from "@/lib/gos-dashboard/kpi-band";

/** Client-confirmed cap (2026-09-24): more than four names wraps to a third row and stretches the panel. */
const TEAM_SHOWN = 4;

/**
 * The Dashboard's setup-and-performance block (client-confirmed, 2026-09-24,
 * approved mockup "A" — "one continuous block").
 *
 * Three panels say *what still needs doing* — Company Profile, Solution
 * Questionnaire, Vision Board — and beneath them, separated by a hairline
 * rather than a gap, workstream hours and the KPI Dashboard say *how things
 * are going*. It is one navy container rather than cards sitting above a
 * band, so the two halves read as one object.
 *
 * Why navy rather than white cards, which was the first design: on white,
 * amber had to compete with body text, navy headings and teal links. Here
 * there is nothing warm anywhere else in the block, so amber reads as "this
 * one needs you" at a glance and green as "handled". Colour carries meaning
 * instead of decorating.
 *
 * Status therefore drives the design rather than sitting on top of it. An
 * unfinished panel gets an amber top rule, an amber figure, a status pill
 * and a solid button; a finished one goes quiet. That is also where the
 * nudge lives now (client-confirmed): the two full-width banners that used
 * to sit under the hero are gone, so nothing has to be dismissed or
 * re-shown, and an account with everything done gets a calm row rather than
 * three cards shouting at it.
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
}: {
  account: CompanyProfile | null;
  canEditProfile: boolean;
  questionnaire: { answered: number; total: number; complete: boolean };
  visionBoard: { answered: number; total: number; complete: boolean; signedBy?: string | null; signedOn?: string | null };
  hours: StepHours[];
  quarter: QuarterInfo;
  kpiSources: KpiSource[];
  accountId: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl p-4 text-white md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {account && <CompanyPanel account={account} canEdit={canEditProfile} />}
        <DocumentPanel
          title="Solution Questionnaire"
          icon={<ClipboardList className="size-3.5" />}
          answered={questionnaire.answered}
          total={questionnaire.total}
          complete={questionnaire.complete}
          href="/settings/growth-questionnaire"
          startLabel="Start questionnaire"
          blurb={
            questionnaire.complete
              ? "Your ideal client profile is set, and the workstream readiness check reads it."
              : "Start here. This defines your ideal client profile, and the rest of GrowthOS reads from it."
          }
          footNote={questionnaire.complete ? "9 sections" : "9 sections · you can stop and come back"}
        />
        <DocumentPanel
          title="Vision Board"
          icon={<Compass className="size-3.5" />}
          answered={visionBoard.answered}
          total={visionBoard.total}
          complete={visionBoard.complete}
          href={visionBoard.complete ? "/vision-board" : "/settings/vision-board"}
          startLabel="Start Vision Board"
          blurb={
            visionBoard.complete && visionBoard.signedBy
              ? `Signed off by ${visionBoard.signedBy}${visionBoard.signedOn ? ` on ${visionBoard.signedOn}` : ""}.`
              : "Ten-year target, core values, the three-year picture and this year's plan."
          }
          footNote={visionBoard.complete ? "PDF available" : "10 sections"}
        />
      </div>

      <div className="h-px bg-white/15" />

      <div>
        <HeroLabel>
          Workstream hours · {quarter.label} · {quarter.range}
        </HeroLabel>
        <HoursTotalsStrip hours={hours} quarter={quarter} variant="hero" />
      </div>

      <div>
        <HeroLabel>KPI Dashboard</HeroLabel>
        <KpiBandHero accountId={accountId} sources={kpiSources} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ parts */

function Panel({
  title,
  icon,
  complete,
  status,
  children,
  foot,
}: {
  title: string;
  icon: ReactNode;
  complete: boolean;
  status: string;
  children: ReactNode;
  foot: ReactNode;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-white/15 bg-white/5">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${complete ? "bg-success-400" : "bg-warning-400"}`} />
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h3 className="flex flex-1 items-center gap-2 text-body-sm font-semibold leading-snug">
          <span className="text-white/50">{icon}</span>
          {title}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-bold uppercase tracking-wide ${
            complete ? "bg-success-400/15 text-success-400" : "bg-warning-400/15 text-warning-400"
          }`}
        >
          {status}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4 pt-3.5">{children}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/12 px-4 py-3">{foot}</div>
    </div>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-caption font-bold uppercase tracking-widest text-white/55">{children}</p>;
}

function Figure({ value, of, complete }: { value: number; of: string; complete: boolean }) {
  return (
    <p className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${complete ? "text-success-400" : "text-warning-400"}`}>
      {value.toLocaleString()} <span className="text-h4 font-semibold text-white/50">/ {of}</span>
    </p>
  );
}

function Meter({ pct, complete }: { pct: number; complete: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
      <div
        className={`h-full rounded-full ${complete ? "bg-success-400" : "bg-warning-400"}`}
        style={{ width: `${Math.max(pct, 1)}%` }}
      />
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-caption leading-relaxed text-white/55">{children}</p>;
}

const CTA_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-body-sm font-semibold text-primary-900 transition-colors hover:bg-white/90";
const QUIET_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3.5 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-white/20";

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-start gap-2 text-body-sm leading-snug text-white/80">
      <span className="mt-0.5 shrink-0 text-white/40">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function CompanyPanel({ account, canEdit }: { account: CompanyProfile; canEdit: boolean }) {
  const address = formatAddress(account);
  const team = (account.sales_marketing_names ?? []).filter((n) => n.trim());
  const shown = team.slice(0, TEAM_SHOWN);
  const extra = team.length - shown.length;
  const c = profileCompleteness(account);

  return (
    <Panel
      title="Company Profile"
      icon={<Building2 className="size-3.5" />}
      complete={c.complete}
      status={c.complete ? "Complete" : `${c.missing.length} to add`}
      foot={
        <>
          <span className="text-caption text-white/55">Shown across GrowthOS</span>
          {canEdit && (
            <Link href="/settings/company" className={c.complete ? QUIET_CLASS : CTA_CLASS}>
              {c.complete ? "Edit →" : "Complete profile"}
            </Link>
          )}
        </>
      }
    >
      <div className="flex items-center gap-3">
        {account.logo_url ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={account.logo_url} alt="" className="max-h-full max-w-full object-contain" />
          </span>
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-body-sm font-bold">
            {initials(account.name)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-h4 font-bold">{account.name}</span>
          {address && <span className="block truncate text-caption text-white/55">{address}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {account.phone && <Fact icon={<Phone className="size-3.5" />}>{account.phone}</Fact>}
        {account.website && (
          <Fact icon={<Globe className="size-3.5" />}>
            <a href={externalHref(account.website)} target="_blank" rel="noreferrer" className="font-medium text-secondary-300 hover:underline">
              {displayUrl(account.website)}
            </a>
          </Fact>
        )}
        {account.linkedin_url && (
          <Fact icon={<LinkIcon className="size-3.5" />}>
            <a href={externalHref(account.linkedin_url)} target="_blank" rel="noreferrer" className="font-medium text-secondary-300 hover:underline">
              LinkedIn
            </a>
          </Fact>
        )}
        {!account.phone && !account.website && !account.linkedin_url && (
          <Fact icon={<MapPin className="size-3.5" />}>
            <span className="text-white/40">No contact details yet</span>
          </Fact>
        )}
      </div>

      <div className="h-px bg-white/12" />

      {account.ceo_name && (
        <div>
          <PanelLabel>Chief Executive Officer</PanelLabel>
          <div className="flex items-center gap-2.5">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-white/15 text-caption font-bold">
              {initials(account.ceo_name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body-sm font-semibold">{account.ceo_name}</span>
              <span className="block text-caption text-white/55">Chief Executive Officer</span>
            </span>
          </div>
        </div>
      )}

      {team.length > 0 && (
        <div>
          <PanelLabel>Sales &amp; Marketing · {team.length}</PanelLabel>
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((person, i) => (
              <li
                key={`${person}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-0.5 pl-0.5 pr-2.5 text-caption font-medium"
              >
                <span className="flex size-[21px] items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">
                  {initials(person)}
                </span>
                {person}
              </li>
            ))}
            {extra > 0 && (
              <li>
                <Link
                  href="/settings/company#sales-marketing"
                  className="inline-flex items-center rounded-full border border-dashed border-white/25 px-2.5 py-1 text-caption font-semibold text-white/70 hover:border-white/50 hover:text-white"
                >
                  +{extra} more
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <div className="mb-2 h-px bg-white/12" />
        <PanelLabel>Profile completeness</PanelLabel>
        <Figure value={c.filled} of={`${c.total} fields`} complete={c.complete} />
        <div className="mt-2.5">
          <Meter pct={(c.filled / c.total) * 100} complete={c.complete} />
        </div>
        {c.missing.length > 0 && <p className="mt-2 text-caption text-white/55">Missing: {c.missing.join(", ")}</p>}
      </div>
    </Panel>
  );
}

function DocumentPanel({
  title,
  icon,
  answered,
  total,
  complete,
  href,
  startLabel,
  blurb,
  footNote,
}: {
  title: string;
  icon: ReactNode;
  answered: number;
  total: number;
  complete: boolean;
  href: string;
  startLabel: string;
  blurb: string;
  footNote: string;
}) {
  const status = complete ? "Complete" : answered === 0 ? "Not started" : "In progress";
  return (
    <Panel
      title={title}
      icon={icon}
      complete={complete}
      status={status}
      foot={
        <>
          <span className="text-caption text-white/55">{footNote}</span>
          <Link href={href} className={complete ? QUIET_CLASS : CTA_CLASS}>
            {complete ? "View →" : answered === 0 ? startLabel : "Continue"}
          </Link>
        </>
      }
    >
      <div>
        <PanelLabel>Questions answered</PanelLabel>
        <Figure value={answered} of={String(total)} complete={complete} />
        <div className="mt-2.5">
          <Meter pct={(answered / total) * 100} complete={complete} />
        </div>
      </div>
      <div className="h-px bg-white/12" />
      <Note>{blurb}</Note>
      {!complete && answered > 0 && <Note>{total - answered} still to answer.</Note>}
    </Panel>
  );
}
