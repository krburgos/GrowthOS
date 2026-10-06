"use client";

import { Check, ChevronRight, ClipboardList, MapPin, Navigation } from "lucide-react";
import { useState } from "react";

import { VisitReportDialog } from "@/components/advocate-dash/visit-report-dialog";
import { REPORT_SECTIONS } from "@/lib/advocate-dash/report-form";
import {
  TARGET_STATUS_CELL,
  TARGET_STATUS_LABEL,
  mapsUrl,
  type AdvocateTarget,
} from "@/lib/advocate-dash/targets";
import { bucketVisits, formatVisitDay, nextStop, owesReport } from "@/lib/advocate-dash/visits";
import { initialsOf, type TeamMember } from "@/lib/team/members";

/**
 * My Visits (client-confirmed, 2026-10-05) — the Advocate's field screen.
 *
 * Deliberately *not* a responsive version of the drop-by table. That table
 * is a review surface for an MSP Owner at a desk: eight columns, sortable,
 * every field editable in place. This answers the two questions an Advocate
 * has while standing in a car park — what is next, and what do I still owe
 * — so it is a short stack of tap targets ordered by urgency, with the
 * report one tap away.
 *
 * Built mobile-first and capped narrow: it stays a single column even on a
 * desktop, because a field screen stretched across 1440px would be a worse
 * version of the table that already exists there.
 *
 * Ordering is read-only here (client-confirmed, 2026-10-06). The round is
 * planned on the AdvocateDash workstream page — the "#" column on the
 * drop-by sheet — and this screen follows it. Drag briefly lived here
 * first; it came off when the client settled that the desk order is
 * authoritative, because both screens read and write the same `sort_order`
 * and a second, phone-only order would have been two numbers to reconcile
 * every time a day was replanned.
 *
 * Scoping: when the viewer's login is linked to a roster entry
 * (`account_team_members.user_id`), this shows only that Advocate's
 * targets. Nothing populates that column yet, so today every viewer gets
 * the whole account with an Advocate filter — which is the right fallback,
 * not a bug: an empty screen would read as broken.
 */
export function VisitsBoard({
  accountId,
  targets,
  advocates,
  myMemberId,
  canEdit,
}: {
  accountId: string;
  targets: AdvocateTarget[];
  /** Everyone holding at least one drop-by, for the filter. */
  advocates: TeamMember[];
  /** The roster entry linked to this login, when there is one. */
  myMemberId: string | null;
  canEdit: boolean;
}) {
  const [advocateId, setAdvocateId] = useState<string | null>(myMemberId);
  const [reportFor, setReportFor] = useState<AdvocateTarget | null>(null);

  // Read-only ordering (client-confirmed, 2026-10-06): the round is planned
  // on the AdvocateDash workstream page and this screen follows it. One
  // sort_order column, written in one place, so the two can never disagree.
  const mine = advocateId ? targets.filter((t) => t.advocate?.id === advocateId) : targets;
  const buckets = bucketVisits(mine).filter((b) => b.targets.length > 0);
  const next = nextStop(buckets);

  const todo = mine.filter((t) => t.status !== "completed").length;
  const owed = mine.filter(owesReport).length;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      {/* The header answers "how much is left" before any list is read. */}
      <section className="rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] p-5 shadow-lift">
        <p className="text-caption font-bold uppercase tracking-wide text-secondary-300">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 text-h2 font-bold text-white">
          {todo === 0 ? "Nothing to visit" : `${todo} drop-${todo === 1 ? "by" : "bys"} to make`}
        </h1>
        <p className="mt-1 text-body-sm text-white/65">
          {owed > 0
            ? `${owed} report${owed === 1 ? "" : "s"} still to write up`
            : "Every visit you have made is written up"}
        </p>

        {next && next.address && (
          <a
            href={mapsUrl(next.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-white px-4 text-body-sm font-semibold text-primary-800 transition-colors hover:bg-secondary-50"
          >
            <Navigation className="size-4" />
            Open next in Maps
          </a>
        )}
      </section>

      {advocates.length > 1 && (
        /* Only shown when the account has more than one Advocate — a filter
           with a single option is furniture. */
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip label="Everyone" active={advocateId === null} onClick={() => setAdvocateId(null)} />
          {advocates.map((a) => (
            <FilterChip
              key={a.id}
              label={a.name}
              active={advocateId === a.id}
              onClick={() => setAdvocateId(a.id)}
            />
          ))}
        </div>
      )}

      {buckets.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center text-body-sm text-neutral-400">
          {advocateId
            ? "No drop-bys assigned to this Advocate."
            : "No drop-by targets on this account yet."}
        </p>
      ) : (
        buckets.map((bucket) => (
          <section key={bucket.key}>
            <div className="mb-2 px-1">
              <h2 className="text-body font-semibold text-primary-900">
                {bucket.title}
                <span className="ml-2 text-body-sm font-normal text-neutral-400">
                  {bucket.targets.length}
                </span>
              </h2>
              {bucket.hint && <p className="text-caption text-neutral-500">{bucket.hint}</p>}
            </div>

            <div className="flex flex-col gap-2.5">
              {bucket.targets.map((target) => (
                <VisitCard
                  key={target.id}
                  target={target}
                  urgent={bucket.key === "overdue" || bucket.key === "owed"}
                  showAdvocate={advocateId === null}
                  onOpenReport={() => setReportFor(target)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {reportFor && (
        <VisitReportDialog
          accountId={accountId}
          target={reportFor}
          canEdit={canEdit}
          onClose={() => setReportFor(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-body-sm font-medium transition-colors motion-reduce:transition-none ${
        active
          ? "border-primary-700 bg-primary-700 text-white"
          : "border-neutral-300 bg-white text-neutral-600 hover:border-secondary-500"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * One drop-by. The whole card is not a link — the report button is the
 * action, and making the card itself tappable too would mean two targets
 * doing different things in the same 44px.
 */
function VisitCard({
  target,
  urgent,
  showAdvocate,
  onOpenReport,
}: {
  target: AdvocateTarget;
  urgent: boolean;
  showAdvocate: boolean;
  onOpenReport: () => void;
}) {
  const submitted = Boolean(target.report?.submitted_at);
  const started = Boolean(target.report);
  const day = formatVisitDay(target.scheduled_for);

  return (
    <article
      className={`rounded-xl border bg-white p-3.5 ${
        urgent ? "border-warning-400 shadow-[0_0_0_3px_var(--color-warning-100)]" : "border-neutral-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-semibold leading-snug text-primary-900">{target.target_name}</h3>
          {target.company_name && (
            <p className="text-caption text-neutral-500">{target.company_name}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-caption font-bold text-white ${TARGET_STATUS_CELL[target.status]}`}
        >
          {TARGET_STATUS_LABEL[target.status]}
        </span>
      </div>

      {target.address && (
        <a
          href={mapsUrl(target.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex min-h-[32px] items-start gap-1.5 text-body-sm leading-snug text-secondary-700 hover:underline"
        >
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          {target.address}
        </a>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500">
        {/* Once a visit has happened, when it was booked for stops being
            news — what it was actually done on is the fact that matters.
            Both are gated on the status, because `completed_on` survives a
            row being moved back off Completed (deliberately — the date is
            history, not state), so an Assigned row can still carry one. */}
        {day && target.status !== "completed" && <span>Booked {day}</span>}
        {target.status === "completed" && target.completed_on && (
          <span>Visited {formatVisitDay(target.completed_on)}</span>
        )}
        {showAdvocate && target.advocate && (
          <span className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-neutral-500 to-neutral-400 text-[8px] font-bold text-white">
              {initialsOf(target.advocate.name)}
            </span>
            {target.advocate.name}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenReport}
        className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 text-body-sm font-semibold transition-colors motion-reduce:transition-none ${
          submitted
            ? "border border-success-200 bg-success-50 text-success-800 hover:bg-success-100"
            : started
              ? "bg-warning-400 text-primary-950 hover:brightness-95"
              : "bg-primary-700 text-white hover:bg-primary-800"
        }`}
      >
        {submitted ? <Check className="size-4" strokeWidth={3} /> : <ClipboardList className="size-4" />}
        {submitted
          ? "View report"
          : started
            ? `Finish report · ${target.report?.sections_done ?? 0}/${REPORT_SECTIONS.length}`
            : "Write the report"}
        {!submitted && <ChevronRight className="size-4" />}
      </button>
    </article>
  );
}
