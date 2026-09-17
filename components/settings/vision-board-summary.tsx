import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  CircleCheck,
  Download,
  Eye,
  Flag,
  Heart,
  Megaphone,
  Pencil,
  PenTool,
  ShieldCheck,
  Target,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VISION_BOARD_SECTIONS } from "@/lib/vision-board/sections";

export interface IcpAnswers {
  targetMarket: string | null;
  focusesOnVerticals: boolean | null;
  hvcDefined: boolean | null;
}

type Answers = Record<string, string | string[] | null>;

const SECTION_ICON: Record<string, LucideIcon> = {
  heart: Heart,
  target: Target,
  flag: Flag,
  megaphone: Megaphone,
  eye: Eye,
  calendar: CalendarCheck,
  alert: AlertTriangle,
  bars: BarChart3,
  trenddown: TrendingDown,
  pen: PenTool,
};

const NOT_ANSWERED = "Not answered";

function text(answers: Answers, key: string): string | null {
  const v = answers[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function list(answers: Answers, key: string): string[] {
  const v = answers[key];
  return Array.isArray(v) ? v.filter((item) => item.trim()) : [];
}

function yesNo(v: boolean | null) {
  return v === null ? NOT_ANSWERED : v ? "Yes" : "No";
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">{children}</p>;
}

function Prose({ value }: { value: string | null }) {
  return (
    <p className={value ? "max-w-[68ch] text-body leading-relaxed text-neutral-800" : "text-body text-neutral-400"}>
      {value ?? NOT_ANSWERED}
    </p>
  );
}

function NumberedList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-body text-neutral-400">{NOT_ANSWERED}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-body leading-relaxed text-neutral-800">
          <span className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-800">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function FigureRow({ figures }: { figures: { label: string; value: string | null }[] }) {
  return (
    <dl
      className="grid grid-cols-2 overflow-hidden rounded-md border border-neutral-100 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
      style={{ "--cols": figures.length } as React.CSSProperties}
    >
      {figures.map((f, i) => (
        <div key={f.label} className={`px-3.5 py-2.5 ${i > 0 ? "sm:border-l sm:border-neutral-100" : ""}`}>
          <dt className="text-caption text-neutral-500">{f.label}</dt>
          <dd className={f.value ? "text-h4 font-bold tabular-nums text-primary-900" : "text-body-sm text-neutral-400"}>
            {f.value ?? NOT_ANSWERED}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Client-confirmed (2026-09-17), "A — Strategy document": once the
 * Vision Board is complete, the page shows every answer top to bottom in
 * wizard order, with a sticky section list, replacing the earlier
 * sign-off banner and "Coming soon" deliverables preview. Each section
 * gets a treatment that fits its answer shape. The ICP stays read-only,
 * sourced from the GrowthOS Solution Questionnaire.
 */
export function VisionBoardSummary({
  accountId,
  answers,
  icpAnswers,
  canEdit,
  onEdit,
}: {
  accountId: string;
  answers: Answers;
  icpAnswers: IcpAnswers;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const signName = text(answers, "signoff_name");
  const signTitle = text(answers, "signoff_title");
  const signDate = text(answers, "signoff_date");
  const values = list(answers, "values_list");
  const metrics = list(answers, "metrics_list");
  const process = list(answers, "process_stages");
  const guarantee = text(answers, "guarantee_text");
  const barrier = text(answers, "barrier_text");
  const target10 = text(answers, "target10_text");

  const body: Record<string, React.ReactNode> = {
    values:
      values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span key={i} className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-body-sm font-medium text-primary-800">
              {v}
            </span>
          ))}
        </div>
      ) : (
        <Prose value={null} />
      ),
    focus: (
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
        <div>
          <Label>Purpose</Label>
          <Prose value={text(answers, "focus_purpose")} />
        </div>
        <div>
          <Label>Niche</Label>
          <Prose value={text(answers, "focus_niche")} />
        </div>
      </div>
    ),
    target10: target10 ? (
      <p className="max-w-[52ch] border-l-[3px] border-secondary-500 py-1 pl-4 text-[18px] font-medium leading-snug text-primary-900">
        {target10}
      </p>
    ) : (
      <Prose value={null} />
    ),
    marketing: (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-2.5 rounded-md border border-dashed border-secondary-300 bg-secondary-50 p-3.5 sm:grid-cols-3">
          <p className="text-caption font-bold uppercase tracking-wide text-secondary-800 sm:col-span-3">
            Ideal Customer Profile · from the GrowthOS Solution Questionnaire
          </p>
          <div>
            <p className="text-caption text-neutral-500">Target market</p>
            <p className="text-body-sm font-medium text-neutral-800">{icpAnswers.targetMarket || NOT_ANSWERED}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">Focuses on specific verticals</p>
            <p className="text-body-sm font-medium text-neutral-800">{yesNo(icpAnswers.focusesOnVerticals)}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">High-value client defined</p>
            <p className="text-body-sm font-medium text-neutral-800">{yesNo(icpAnswers.hvcDefined)}</p>
          </div>
        </div>
        <div>
          <Label>Three Uniques™</Label>
          <NumberedList items={["unique_1", "unique_2", "unique_3"].map((k) => text(answers, k)).filter((v): v is string => !!v)} />
        </div>
        <div>
          <Label>Proven Process</Label>
          {process.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {process.map((stage, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="size-3.5 text-neutral-300" aria-hidden="true" />}
                  <span className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-body-sm font-semibold text-primary-700">
                    {stage}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <Prose value={null} />
          )}
        </div>
        <div>
          <Label>Guarantee</Label>
          {guarantee ? (
            <div className="flex items-start gap-2.5 rounded-md bg-success-100 px-3.5 py-2.5 text-body leading-relaxed text-neutral-800">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-700" />
              {guarantee}
            </div>
          ) : (
            <Prose value={null} />
          )}
        </div>
      </div>
    ),
    picture3: (
      <div className="flex flex-col gap-5">
        <FigureRow
          figures={[
            { label: "Annual revenue", value: text(answers, "picture3_revenue") },
            { label: "Gross profit", value: text(answers, "picture3_gross_profit") },
            { label: "Net profit", value: text(answers, "picture3_net_profit") },
            { label: "MRR", value: text(answers, "picture3_mrr") },
          ]}
        />
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
          {[
            ["Team", "picture3_team"],
            ["Clients", "picture3_clients"],
            ["Market position", "picture3_market_position"],
            ["Operations", "picture3_operations"],
          ].map(([label, key]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Prose value={text(answers, key)} />
            </div>
          ))}
        </div>
      </div>
    ),
    plan1: (
      <div className="flex flex-col gap-5">
        <FigureRow
          figures={[
            { label: "Revenue goal", value: text(answers, "plan1_revenue_goal") },
            { label: "Gross profit goal", value: text(answers, "plan1_gross_profit_goal") },
            { label: "Net profit goal", value: text(answers, "plan1_net_profit_goal") },
            { label: "MRR goal", value: text(answers, "plan1_mrr_goal") },
            { label: "New clients", value: text(answers, "plan1_new_client_goal") },
          ]}
        />
        <div>
          <Label>Top annual priorities</Label>
          <NumberedList items={list(answers, "plan1_priorities")} />
        </div>
      </div>
    ),
    obstacles: <NumberedList items={list(answers, "obstacles_list")} />,
    metrics:
      metrics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {metrics.map((m, i) => (
            <span key={i} className="rounded-md bg-neutral-100 px-2.5 py-1 text-body-sm font-medium text-neutral-700">
              {m}
            </span>
          ))}
        </div>
      ) : (
        <Prose value={null} />
      ),
    barrier: (
      <div>
        <Label>The biggest barrier to doubling revenue in 36 months</Label>
        {barrier ? (
          <p className="rounded-md bg-warning-100 px-4 py-3 text-body font-medium leading-relaxed text-neutral-800">{barrier}</p>
        ) : (
          <Prose value={null} />
        )}
      </div>
    ),
    signoff: (
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-h3 font-semibold text-primary-900">{signName ?? NOT_ANSWERED}</span>
        <span className="text-body-sm text-neutral-500">
          {[signTitle, signDate ? `Signed ${signDate}` : null].filter(Boolean).join(" · ")}
        </span>
      </div>
    ),
  };

  const countNote: Record<string, string | undefined> = {
    values: values.length ? `${values.length} values` : undefined,
    metrics: metrics.length ? `${metrics.length} metrics` : undefined,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-h1 text-primary-900">GrowthOS Vision Board</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-body-sm text-neutral-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 py-0.5 pl-1.5 pr-2.5 text-caption font-semibold text-success-700">
              <CircleCheck className="size-3.5" strokeWidth={2.25} />
              Complete
            </span>
            {signName && (
              <span>
                Signed off by <b className="font-semibold text-neutral-800">{signName}</b>
                {signTitle ? `, ${signTitle}` : ""}
                {signDate ? ` · ${signDate}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canEdit && (
            <Button variant="secondary" onClick={onEdit}>
              <Pencil className="mr-1.5 size-4" />
              Edit Vision Board
            </Button>
          )}
          <Button asChild>
            <a href={`/api/vision-board/export?account_id=${accountId}`}>
              <Download className="mr-1.5 size-4" />
              Export PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Vision Board sections" className="sticky top-6 hidden flex-col gap-px lg:flex">
          <p className="mb-1.5 ml-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Sections</p>
          {VISION_BOARD_SECTIONS.map((s, i) => (
            <a
              key={s.key}
              href={`#vb-${s.key}`}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-neutral-600 hover:bg-white hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
            >
              <span className="w-4 text-caption font-semibold tabular-nums text-neutral-400">
                {s.key === "signoff" ? "✓" : i + 1}
              </span>
              {s.name}
            </a>
          ))}
        </nav>

        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {VISION_BOARD_SECTIONS.map((s) => {
            const Icon = SECTION_ICON[s.icon];
            return (
              <section key={s.key} id={`vb-${s.key}`} className="scroll-mt-6 px-6 py-5">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="text-h4 text-primary-900">{s.name}</h2>
                  {countNote[s.key] && (
                    <span className="ml-auto text-caption tabular-nums text-neutral-400">{countNote[s.key]}</span>
                  )}
                </div>
                {body[s.key]}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
