import { ArrowRight, Check, Pencil, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MissionSteps } from "@/components/growth-mission/mission-steps";
import { ApproveIcpButton } from "@/components/icp/approve-icp-button";
import { InfoTip } from "@/components/ui/info-tip";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import type { UserRole } from "@/lib/auth/get-current-user";
import { encodeRule } from "@/lib/contacts/filters";
import type { ApproverRole, IcpFit, IcpSignoff, IcpState } from "@/lib/icp/queries";
import { sizeLabel } from "@/lib/icp/rules";

const QUESTIONNAIRE = "/settings/growth-questionnaire";
const editHref = (step: string) => `${QUESTIONNAIRE}?step=${step}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const SLOT_LABEL: Record<ApproverRole, string> = { msp_owner: "MSP Owner", cro_admin: "CRO Leader" };

/**
 * The ICP Mission Card's workspace (client-confirmed, 2026-10-23, approved
 * mockup "ICP & List Building Cards"). The profile is the Solution
 * Questionnaire's ICP answers, shown, never captured again: every Edit goes
 * back to the questionnaire step it came from. An MSP Owner and a CRO Admin
 * both approve it; the Fit check shows how much of the CRM matches it.
 */
export function IcpProfile({
  state,
  fit,
  hasIcpList,
  viewerRole,
  accountId,
  focusSlot,
}: {
  state: IcpState;
  fit: IcpFit;
  hasIcpList: boolean;
  viewerRole: UserRole;
  accountId: string;
  focusSlot?: ReactNode;
}) {
  const { icp, signoffs } = state;
  const mySlot: ApproverRole | null = viewerRole === "msp_owner" || viewerRole === "cro_admin" ? viewerRole : null;
  const canApprove = !!mySlot && state.complete && !signoffs[mySlot]?.current;
  const contactsHref = `/contacts?${state.rules.map((r) => `f=${encodeURIComponent(encodeRule(r))}`).join("&")}`;
  const pct = (n: number) => (fit.total ? Math.round((n / fit.total) * 100) : 0);

  const industries = [...icp.industries, ...(icp.industriesOther ? [icp.industriesOther] : [])];
  const size = sizeLabel(icp.companySize);

  return (
    <section id="icp-profile" className="scroll-mt-6 overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <div className="min-w-0">
          <h2 className="text-h4 text-white">Ideal Client Profile</h2>
          <p className="mt-0.5 text-body-sm text-secondary-300">
            From the Solution Questionnaire{state.updatedAt ? ` · last edited ${date(state.updatedAt)}` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {focusSlot}
          <Link
            href={editHref("icp_target")}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-body-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Pencil className="size-3.5" />
            Edit answers
          </Link>
          {canApprove && <ApproveIcpButton accountId={accountId} role={mySlot!} answers={state.answers} />}
          {state.approved && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-success-400 px-3 text-body-sm font-semibold text-success-950">
              <Check className="size-4" />
              Approved
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-primary-200 px-5 py-2.5">
        <Signoff slot="msp_owner" signoff={signoffs.msp_owner} />
        <Signoff slot="cro_admin" signoff={signoffs.cro_admin} />
        {state.changedSinceApproval && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-1 text-caption font-semibold text-warning-800">
            <TriangleAlert className="size-3.5" />
            Changed since approval
          </span>
        )}
      </div>

      <MissionSteps
        steps={[
          {
            label: "Review the profile",
            done: state.complete,
            tip: "Read each answer below. Anything that has changed since the questionnaire? Use Edit answers.",
          },
          {
            label: "Approve it with your sales lead",
            done: state.approved,
            tip: "Your MSP Owner and CRO Leader both approve. This is who we sell to, and what lists and campaigns are built from.",
          },
          {
            label: "Build a list from it",
            done: hasIcpList,
            href: "/growth-mission/list-building",
            hrefLabel: "List Building",
          },
        ]}
      />

      <div className="grid grid-cols-2 border-b border-primary-200 bg-primary-50 lg:grid-cols-4 lg:divide-x lg:divide-primary-200">
        <Stat label="Industries" value={industries.length ? `${industries.length} ranked` : "—"} />
        <Stat label="Company size" value={size || "—"} />
        <Stat label="Decision makers" value={icp.decisionMakers.join(", ") || "—"} />
        <div className="flex flex-col gap-0.5 px-5 py-3.5">
          <span className="flex items-center gap-1.5 text-caption text-primary-700">
            Contacts that fit
            <InfoTip
              text="Contacts in your CRM whose company industry, employee size and job title all match this profile."
              label="About Contacts that fit"
            />
          </span>
          <span className="text-h3 font-bold tabular-nums text-primary-900">
            {fit.all.toLocaleString()} <span className="text-body font-medium text-primary-700">of {fit.total.toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-3.5 p-5 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Target companies" step="icp_target" empty={!industries.length && !size && !icp.coverage}>
          {industries.length > 0 && (
            <Field label="Industries, ranked">
              <ol className="flex flex-col gap-1">
                {industries.map((name, i) => (
                  <li key={name} className="flex items-center gap-2 text-body text-neutral-800">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-900 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {name}
                  </li>
                ))}
              </ol>
            </Field>
          )}
          <Chips label="Company size" items={icp.companySize} />
          <Text label="Coverage area" value={icp.coverage} />
        </Card>

        <Card
          title="Decision makers & technology"
          step="icp_people_tech"
          empty={!icp.decisionMakers.length && !icp.itEnvironment.length && !icp.softwareStack && !icp.painPoints}
        >
          <Chips label="Who signs" items={icp.decisionMakers} />
          <Chips label="Current IT" items={icp.itEnvironment} />
          <Text label="Software stack" value={icp.softwareStack} />
          <Text label="Pain points" value={icp.painPoints} />
        </Card>

        <Card
          title="Business needs & lead type"
          step="icp_needs"
          empty={!icp.compliance && !icp.growthStage && !icp.budget && !icp.leadTypes.length && !icp.competitors.length}
        >
          {(icp.compliance || icp.growthStage || icp.budget) && (
            <div className="grid grid-cols-2 gap-3">
              <Text label="Compliance" value={icp.compliance} />
              <Text label="Growth stage" value={icp.growthStage} />
              <Text label="IT budget" value={icp.budget} />
            </div>
          )}
          <Chips label="Leads we want" items={icp.leadTypes} />
          <Text label="Who we compete with" value={icp.competitors.join(", ") || null} />
        </Card>

        <Card
          title="Your MSP & messaging"
          step="icp_msp"
          wide
          empty={!icp.valueProp && !icp.keyMessages && !icp.challenges.length && !icp.dosDonts}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text label="Why they choose us" value={icp.valueProp} />
            <Text label="Key messages or offers" value={icp.keyMessages} />
            <Chips label="Their common challenges" items={icp.challenges} />
            <Text label="Messaging do's & don'ts" value={icp.dosDonts} />
          </div>
        </Card>

        <Card title="Buying-intent topics" step="icp_intent" empty={!icp.intentTopics.length}>
          <div className="flex flex-wrap gap-1.5">
            {icp.intentTopics.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-primary-200 bg-primary-100 px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-bold text-primary-900">
          Fit check
          <InfoTip
            text="How many of your CRM contacts match each part of the profile. A contact that matches all three is a fit."
            label="About the Fit check"
          />
        </span>
        <Bar label="Industry" value={pct(fit.industry)} />
        <Bar label="Size" value={pct(fit.size)} />
        <Bar label="Title" value={pct(fit.title)} />
        {fit.all > 0 && (
          <Link href={contactsHref} className="ml-auto inline-flex items-center gap-1 text-body-sm font-semibold text-secondary-700 hover:underline">
            See the {fit.all.toLocaleString()} contacts
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}

function Signoff({ slot, signoff }: { slot: ApproverRole; signoff: IcpSignoff | null }) {
  const current = !!signoff?.current;
  return (
    <span className="inline-flex items-center gap-2 text-body-sm">
      <span className="text-neutral-500">{SLOT_LABEL[slot]}</span>
      {current ? (
        <span className="inline-flex items-center gap-1 font-semibold text-success-800">
          <Check className="size-3.5" />
          Approved by {signoff!.name ?? SLOT_LABEL[slot]} · {date(signoff!.at)}
        </span>
      ) : (
        <span className="font-semibold text-neutral-600">Waiting</span>
      )}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-5 py-3.5">
      <span className="text-caption text-primary-700">{label}</span>
      <span className="truncate text-h3 font-bold text-primary-900" title={value}>
        {value}
      </span>
    </div>
  );
}

function Card({ title, step, wide, empty, children }: { title: string; step: string; wide?: boolean; empty: boolean; children: ReactNode }) {
  return (
    <article className={`flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-caption font-bold uppercase tracking-wide text-primary-700">{title}</h3>
        <Link href={editHref(step)} className="text-caption font-semibold text-secondary-700 hover:underline">
          Edit
        </Link>
      </div>
      {empty ? <p className="text-body-sm text-neutral-500">Not answered yet.</p> : children}
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function Text({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-neutral-500">{label}</span>
      <span className="whitespace-pre-line text-body text-neutral-800">{value}</span>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
    </Field>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-caption font-semibold text-primary-900">{children}</span>;
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-14 text-caption text-primary-700">{label}</span>
      <span className="block h-2 w-28 overflow-hidden rounded-full bg-white" aria-hidden="true">
        <span className="block h-full bg-secondary-600" style={{ width: `${value}%` }} />
      </span>
      <span className="w-10 text-right text-body-sm font-semibold tabular-nums text-primary-900">{value}%</span>
    </span>
  );
}
