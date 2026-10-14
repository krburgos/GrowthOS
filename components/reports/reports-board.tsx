"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { CampaignRow, MissionFigures, QuarterReport, ReportsData, StageCount } from "@/lib/reports/data";

/**
 * The Reports page (client-confirmed, 2026-10-14, approved mockup "Reports
 * Redesign"). One quarter drives everything: the picker reloads the page
 * for that quarter, and Compare draws the quarter before it in grey.
 *
 * Every section keeps its own Export to Spreadsheet button (App Flow
 * §4.8, the client's direction), now following the chosen quarter.
 *
 * Charts follow the dataviz rules this app uses elsewhere: one axis each,
 * thin marks with rounded data ends, a hover tooltip on every mark, and
 * colour carrying meaning only where the app already gives it one (cyan for
 * the chosen quarter, grey for the comparison, green for won).
 */

const C = {
  cur: "var(--color-secondary-600)",
  prev: "var(--color-neutral-300)",
  prevLine: "var(--color-neutral-400)",
  req: "var(--color-primary-200)",
  won: "var(--color-success-600)",
  lost: "var(--color-neutral-300)",
  grid: "var(--color-neutral-100)",
  base: "var(--color-neutral-300)",
  axis: "var(--color-neutral-500)",
  ink: "var(--color-neutral-800)",
  navy: "var(--color-primary-900)",
};

const fmt = (n: number) => Math.round(n).toLocaleString();
const money = (n: number) => `$${fmt(n)}`;
const short$ = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${fmt(n)}`);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

function niceMax(v: number) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / p);
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

interface Tip {
  x: number;
  y: number;
  lines: ReactNode;
}

export function ReportsBoard({ data }: { data: ReportsData }) {
  const router = useRouter();
  const [compare, setCompare] = useState(true);
  const [tip, setTip] = useState<Tip | null>(null);

  const q = data.selected;
  const p = data.previous;
  const showPrev = compare && p !== null;

  const tipAt = (e: React.MouseEvent, lines: ReactNode) => setTip({ x: e.clientX, y: e.clientY, lines });
  const hideTip = () => setTip(null);
  const exportHref = (section: string) => `/api/reports/export?section=${section}&q=${q.key}`;

  const kpis: { label: string; cur: number; prev: number | null; show: (n: number) => string }[] = [
    { label: "Leads added", cur: sum(q.leadsWeekly), prev: p ? sum(p.leadsWeekly) : null, show: fmt },
    { label: "Opportunities created", cur: q.oppsCreated, prev: p ? p.oppsCreated : null, show: fmt },
    { label: "Revenue won", cur: sum(q.revenueMonthly), prev: p ? sum(p.revenueMonthly) : null, show: money },
    {
      label: "Mission hours completed",
      cur: q.mission?.hoursCompleted ?? 0,
      prev: p?.mission ? p.mission.hoursCompleted : null,
      show: fmt,
    },
    { label: "Credits used", cur: q.mission?.creditsUsed ?? 0, prev: p?.mission ? p.mission.creditsUsed : null, show: fmt },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="text-h1 text-primary-900">Reports</h1>
          <p className="text-body text-neutral-500">How the account is doing, quarter by quarter, from real data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="report-quarter" className="sr-only">
            Quarter
          </label>
          <select
            id="report-quarter"
            value={q.key}
            onChange={(e) => router.push(`/reports?q=${e.target.value}`)}
            className="h-10 cursor-pointer rounded-md border border-neutral-300 bg-white px-3 text-body font-semibold text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            {data.quarters.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
                {x.isCurrent ? " · current" : ""}
              </option>
            ))}
          </select>
          {p && (
            <button
              type="button"
              role="switch"
              aria-checked={compare}
              onClick={() => setCompare((c) => !c)}
              className="inline-flex items-center gap-2 rounded-md px-1 text-body-sm text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
            >
              <span
                aria-hidden="true"
                className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${compare ? "bg-secondary-600" : "bg-neutral-300"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${compare ? "translate-x-[14px]" : ""}`}
                />
              </span>
              Compare with {p.label}
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Report sections" className="flex flex-wrap gap-1.5">
        {[
          ["mission", "Mission"],
          ["leads", "Leads"],
          ["pipeline", "Pipeline"],
          ["campaigns", "Campaigns"],
          ["revenue", "Revenue"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-primary-100 bg-white px-3 py-1 text-caption font-semibold text-primary-700 hover:border-primary-200 hover:bg-primary-50"
          >
            {label}
          </a>
        ))}
      </nav>

      <section
        aria-label="Headline figures"
        className="rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] p-4 shadow-lift"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-white px-3.5 py-3">
              <span className="text-caption font-medium text-neutral-500">
                {k.label}
                {q.isCurrent ? " · so far" : ""}
              </span>
              <span className="text-h2 font-bold tabular-nums text-primary-900">{k.show(k.cur)}</span>
              <Delta cur={k.cur} prev={k.prev} against={p?.label} />
            </div>
          ))}
        </div>
      </section>

      <Card
        id="mission"
        title="Mission"
        subtitle={q.isCurrent ? `${q.label} so far · the quarter hasn't closed yet` : `${q.label} · closed, figures locked at the close`}
        exportHref={exportHref("mission")}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[5fr_6fr]">
          <div className="px-5 pb-4">
            {q.mission ? (
              <Headline
                value={`${q.mission.hoursRequired > 0 ? Math.round((q.mission.hoursCompleted / q.mission.hoursRequired) * 100) : 0}%`}
                text={`of ${q.label}'s required hours completed${q.mission.ordersCarried !== null ? ` · ${q.mission.ordersCarried} orders carried forward` : ""}`}
              />
            ) : (
              <Headline value="—" text={`No locked figures for ${q.label}`} />
            )}
            <HoursChart history={data.history} selectedKey={q.key} onTip={tipAt} onLeave={hideTip} />
            <Legend items={[{ swatch: C.cur, label: "Hours completed" }, { swatch: "outline", label: "Hours required" }]} />
          </div>
          <div className="border-t border-neutral-100 px-5 pb-4 pt-3 xl:border-l xl:border-t-0">
            <HistoryTable history={data.history} selectedKey={q.key} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="leads" title="Leads & Contacts Added" subtitle="Weekly, across the quarter" exportHref={exportHref("leads")}>
          <div className="px-5 pb-4">
            <Headline value={fmt(sum(q.leadsWeekly))} text={`added in ${q.label}${q.isCurrent ? " so far" : ""}`} />
            <LeadsChart q={q} p={showPrev ? p : null} onTip={tipAt} onLeave={hideTip} />
            <Legend
              items={[
                { swatch: C.cur, label: q.label },
                ...(showPrev && p ? [{ swatch: "dash", label: p.label }] : []),
              ]}
            />
          </div>
        </Card>

        <Card id="pipeline" title="Opportunities by Stage" subtitle="Where every opportunity sits today" exportHref={exportHref("pipeline")}>
          <div className="px-5 pb-4">
            <Headline value={fmt(sum(data.stages.map((s) => s.count)))} text={`opportunities · ${q.oppsCreated} created in ${q.label}`} />
            <StageChart stages={data.stages} onTip={tipAt} onLeave={hideTip} />
            <Legend
              items={[
                { swatch: C.cur, label: "Open" },
                { swatch: C.won, label: "Won" },
                { swatch: C.lost, label: "Lost" },
              ]}
            />
          </div>
        </Card>

        <Card id="campaigns" title="Campaign Performance" subtitle={`Campaigns sent in ${q.label}`} exportHref={exportHref("campaigns")}>
          <CampaignTable campaigns={q.campaigns} quarter={q.label} />
        </Card>

        <Card id="revenue" title="Revenue from Closed-Won" subtitle="By month, across the quarter" exportHref={exportHref("revenue")}>
          <div className="px-5 pb-4">
            <Headline
              value={money(sum(q.revenueMonthly))}
              text={`won in ${q.label}${q.isCurrent ? " so far" : ""} · ${q.dealsWon} ${q.dealsWon === 1 ? "deal" : "deals"}${
                p ? ` · ${money(sum(p.revenueMonthly))} in ${p.label}` : ""
              }`}
            />
            <RevenueChart q={q} p={showPrev ? p : null} onTip={tipAt} onLeave={hideTip} />
            <Legend
              items={[
                { swatch: C.won, label: q.label },
                ...(showPrev && p ? [{ swatch: C.prev, label: p.label }] : []),
              ]}
            />
          </div>
        </Card>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-60 rounded-md bg-primary-900 px-2.5 py-1.5 text-caption text-white shadow-md"
          style={{ left: Math.min(tip.x + 12, (typeof window !== "undefined" ? window.innerWidth : 1200) - 250), top: tip.y - 54 }}
        >
          {tip.lines}
        </div>
      )}
    </main>
  );
}

function Card({
  id,
  title,
  subtitle,
  exportHref,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  exportHref: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex min-w-0 scroll-mt-4 flex-col rounded-xl border border-primary-100 bg-white shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-1 pt-4">
        <div className="min-w-0">
          <h2 className="text-h4 text-primary-900">{title}</h2>
          <p className="text-caption text-neutral-500">{subtitle}</p>
        </div>
        {/* App Flow §4.8: every section has its own Export to Spreadsheet. */}
        <a
          href={exportHref}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-caption font-semibold text-primary-700 transition-colors hover:border-primary-700"
        >
          <Download className="size-3.5" />
          Export
        </a>
      </div>
      {children}
    </section>
  );
}

function Headline({ value, text }: { value: string; text: string }) {
  return (
    <p className="mb-1 mt-2 flex flex-wrap items-baseline gap-x-2">
      <span className="text-h3 font-bold tabular-nums text-primary-900">{value}</span>
      <span className="text-caption text-neutral-500">{text}</span>
    </p>
  );
}

function Delta({ cur, prev, against }: { cur: number; prev: number | null; against?: string }) {
  if (prev === null || !against) return <span className="text-caption text-neutral-400">First quarter on record</span>;
  if (prev === 0) {
    return <span className="text-caption text-neutral-500">{cur > 0 ? `New this quarter · none in ${against}` : `None in ${against} either`}</span>;
  }
  const d = Math.round(((cur - prev) / prev) * 100);
  const tone = d > 0 ? "text-success-700" : d < 0 ? "text-error-700" : "text-neutral-500";
  return (
    <span className={`text-caption font-semibold tabular-nums ${tone}`}>
      {d > 0 ? "▲ " : d < 0 ? "▼ " : ""}
      {Math.abs(d)}% <span className="font-normal text-neutral-400">vs {against}</span>
    </span>
  );
}

function Legend({ items }: { items: { swatch: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-caption text-neutral-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.swatch === "dash" ? (
            <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-neutral-400" />
          ) : i.swatch === "outline" ? (
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px] border-[1.5px] border-primary-200 bg-white" />
          ) : (
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px]" style={{ background: i.swatch }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

type TipFn = (e: React.MouseEvent, lines: ReactNode) => void;

/** Recessive horizontal grid with value labels, shared by every chart. */
function YGrid({ W, H, M, max, ticks, show = fmt }: { W: number; H: number; M: Margin; max: number; ticks: number; show?: (n: number) => string }) {
  return (
    <g>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = M.t + (H - M.t - M.b) * (1 - i / ticks);
        return (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke={C.grid} />
            <text x={M.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill={C.axis}>
              {show((max / ticks) * i)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface Margin {
  t: number;
  r: number;
  b: number;
  l: number;
}

function HoursChart({
  history,
  selectedKey,
  onTip,
  onLeave,
}: {
  history: ReportsData["history"];
  selectedKey: string;
  onTip: TipFn;
  onLeave: () => void;
}) {
  // The four most recent quarters, oldest on the left.
  const span = history.slice(0, 4).reverse();
  const W = 460;
  const H = 210;
  const M: Margin = { t: 10, r: 8, b: 28, l: 40 };
  const max = niceMax(Math.max(...span.map((s) => Math.max(s.hoursRequired, s.hoursCompleted)), 1));
  const ph = H - M.t - M.b;
  const bw = (W - M.l - M.r) / Math.max(span.length, 1);

  if (span.length === 0) return <p className="py-10 text-center text-body-sm text-neutral-400">No quarters on record yet.</p>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Hours required and completed by quarter">
      <YGrid W={W} H={H} M={M} max={max} ticks={4} />
      {span.map((s, i) => {
        const on = s.key === selectedKey;
        const x = M.l + bw * i + bw * 0.22;
        const w = bw * 0.56;
        const hr = (s.hoursRequired / max) * ph;
        const hc = (s.hoursCompleted / max) * ph;
        return (
          <g key={s.key}>
            <rect x={x} y={H - M.b - hr} width={w} height={hr} rx={4} fill="white" stroke={C.req} strokeWidth={1.5} />
            <rect x={x + 5} y={H - M.b - hc} width={Math.max(w - 10, 0)} height={hc} rx={4} fill={C.cur} opacity={on ? 1 : 0.45} />
            <text x={x + w / 2} y={H - 9} textAnchor="middle" fontSize={11} fill={on ? C.navy : C.axis} fontWeight={on ? 700 : 400}>
              {s.label}
            </text>
            <rect
              x={M.l + bw * i}
              y={M.t}
              width={bw}
              height={ph}
              fill="transparent"
              onMouseMove={(e) =>
                onTip(
                  e,
                  <>
                    <b>{s.label}</b>
                    {s.isCurrent ? " · so far" : ""}
                    <br />
                    {fmt(s.hoursCompleted)} of {fmt(s.hoursRequired)} hrs completed
                    <br />
                    <span className="text-secondary-300">{fmt(s.creditsUsed)} credits used</span>
                  </>
                )
              }
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={C.base} />
    </svg>
  );
}

function HistoryTable({ history, selectedKey }: { history: ReportsData["history"]; selectedKey: string }) {
  const cols: [string, (m: MissionFigures) => ReactNode][] = [
    ["Hrs required", (m) => fmt(m.hoursRequired)],
    [
      "Hrs completed",
      (m) => {
        const pct = m.hoursRequired > 0 ? Math.min(100, Math.round((m.hoursCompleted / m.hoursRequired) * 100)) : 0;
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            <span aria-hidden="true" className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
              <span className="block h-full rounded-full bg-secondary-600" style={{ width: `${pct}%` }} />
            </span>
            {fmt(m.hoursCompleted)}
          </span>
        );
      },
    ],
    ["Credits used", (m) => fmt(m.creditsUsed)],
    ["Orders done", (m) => fmt(m.ordersCompleted)],
    ["Carried fwd", (m) => (m.ordersCarried === null ? "—" : fmt(m.ordersCarried))],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-body-sm tabular-nums">
        <thead>
          <tr>
            <th className={TH_LEFT}>Quarter</th>
            {cols.map(([h]) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((m) => {
            const on = m.key === selectedKey;
            return (
              <tr key={m.key} className={on ? "bg-secondary-50" : ""}>
                <td className={`${TD} text-left ${on ? "shadow-[inset_3px_0_0_var(--color-secondary-500)]" : ""}`}>
                  <span className="font-semibold text-primary-900">{m.label}</span>
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                      m.isCurrent ? "bg-secondary-100 text-secondary-800" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {m.isCurrent ? "so far" : "locked"}
                  </span>
                </td>
                {cols.map(([h, cell]) => (
                  <td key={h} className={`${TD} text-right`}>
                    {cell(m)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TH = "whitespace-nowrap border-b border-primary-200 bg-primary-50 px-3 py-2 text-right text-caption font-bold uppercase tracking-wide text-primary-700";
const TH_LEFT = TH.replace("text-right", "text-left");
const TD = "whitespace-nowrap border-b border-neutral-100 px-3 py-2.5 text-neutral-700";

function LeadsChart({ q, p, onTip, onLeave }: { q: QuarterReport; p: QuarterReport | null; onTip: TipFn; onLeave: () => void }) {
  const W = 560;
  const H = 220;
  const M: Margin = { t: 10, r: 10, b: 28, l: 32 };
  const n = q.leadsWeekly.length;
  const cur = q.leadsWeekly.slice(0, q.weeksElapsed);
  const max = niceMax(Math.max(...cur, ...(p ? p.leadsWeekly : []), 1));
  const step = (W - M.l - M.r) / (n - 1);
  const sx = (i: number) => M.l + step * i;
  const sy = (v: number) => M.t + (H - M.t - M.b) * (1 - v / max);
  const pts = (a: number[]) => a.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Leads and contacts added each week">
      <YGrid W={W} H={H} M={M} max={max} ticks={4} />
      {p && <polyline fill="none" stroke={C.prevLine} strokeWidth={2} strokeDasharray="5 4" points={pts(p.leadsWeekly)} />}
      {cur.length > 0 && (
        <>
          <polygon fill={C.cur} opacity={0.12} points={`${sx(0)},${sy(0)} ${pts(cur)} ${sx(cur.length - 1)},${sy(0)}`} />
          <polyline fill="none" stroke={C.cur} strokeWidth={2} strokeLinejoin="round" points={pts(cur)} />
          <circle cx={sx(cur.length - 1)} cy={sy(cur[cur.length - 1])} r={4.5} fill={C.cur} stroke="white" strokeWidth={2} />
        </>
      )}
      {[0, 4, 8, 12].map((i) => (
        <text key={i} x={sx(i)} y={H - 9} textAnchor="middle" fontSize={11} fill={C.axis}>
          {q.weekStarts[i]}
        </text>
      ))}
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={C.base} />
      {q.leadsWeekly.map((v, i) => (
        <rect
          key={i}
          x={sx(i) - step / 2}
          y={M.t}
          width={step}
          height={H - M.t - M.b}
          fill="transparent"
          onMouseMove={(e) =>
            onTip(
              e,
              <>
                <b>Week of {q.weekStarts[i]}</b>
                <br />
                {i < q.weeksElapsed ? `${v} added in ${q.label}` : "Not reached yet"}
                {p && (
                  <>
                    <br />
                    <span className="text-secondary-300">
                      {p.leadsWeekly[i]} in {p.label}
                    </span>
                  </>
                )}
              </>
            )
          }
          onMouseLeave={onLeave}
        />
      ))}
    </svg>
  );
}

function StageChart({ stages, onTip, onLeave }: { stages: StageCount[]; onTip: TipFn; onLeave: () => void }) {
  const W = 560;
  const H = 230;
  const M: Margin = { t: 16, r: 6, b: 62, l: 28 };
  const total = sum(stages.map((s) => s.count));
  const max = niceMax(Math.max(...stages.map((s) => s.count), 1));
  const cw = (W - M.l - M.r) / Math.max(stages.length, 1);
  const ph = H - M.t - M.b;
  const fill = (g: string) => (g === "won" ? C.won : g === "lost" ? C.lost : C.cur);

  if (stages.length === 0) return <p className="py-10 text-center text-body-sm text-neutral-400">No pipeline stages set up yet.</p>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Opportunities by stage">
      <YGrid W={W} H={H} M={M} max={max} ticks={2} />
      {stages.map((s, i) => {
        const h = (s.count / max) * ph;
        const x = M.l + cw * i + cw * 0.24;
        const w = cw * 0.52;
        const label = s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name;
        return (
          <g key={s.id}>
            {s.count > 0 && <rect x={x} y={H - M.b - h} width={w} height={h} rx={3} fill={fill(s.stage_group)} />}
            <text x={x + w / 2} y={H - M.b - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={s.count ? C.ink : C.base}>
              {s.count}
            </text>
            <text
              x={x + w / 2}
              y={H - M.b + 12}
              textAnchor="end"
              fontSize={10.5}
              fill={C.axis}
              transform={`rotate(-38 ${x + w / 2} ${H - M.b + 12})`}
            >
              {label}
            </text>
            <rect
              x={M.l + cw * i}
              y={M.t}
              width={cw}
              height={ph}
              fill="transparent"
              onMouseMove={(e) =>
                onTip(
                  e,
                  <>
                    <b>{s.name}</b>
                    <br />
                    {s.count} {s.count === 1 ? "opportunity" : "opportunities"}
                    {total > 0 ? ` · ${Math.round((s.count / total) * 100)}% of all` : ""}
                  </>
                )
              }
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={C.base} />
    </svg>
  );
}

function CampaignTable({ campaigns, quarter }: { campaigns: CampaignRow[]; quarter: string }) {
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  if (campaigns.length === 0) {
    return <p className="px-5 py-10 text-center text-body-sm text-neutral-400">No campaigns were sent in {quarter}.</p>;
  }
  return (
    <div className="overflow-x-auto px-5 pb-4 pt-2">
      <table className="w-full min-w-[520px] border-collapse text-body-sm tabular-nums">
        <thead>
          <tr>
            <th className={TH_LEFT}>Campaign</th>
            {["Sent", "Opened", "Clicked", "Bounced", "Unsub."].map((h) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td className={`${TD} max-w-[220px] truncate text-left font-semibold text-primary-900`} title={c.name}>
                {c.name}
              </td>
              <td className={`${TD} text-right`}>{fmt(c.sent)}</td>
              <td className={`${TD} text-right`}>
                <span className="inline-flex items-center justify-end gap-1.5">
                  <span aria-hidden="true" className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                    <span className="block h-full rounded-full bg-secondary-600" style={{ width: pct(c.openRate) === "—" ? 0 : pct(c.openRate) }} />
                  </span>
                  {pct(c.openRate)}
                </span>
              </td>
              <td className={`${TD} text-right`}>{pct(c.clickRate)}</td>
              <td className={`${TD} text-right`}>{fmt(c.bounced)}</td>
              <td className={`${TD} text-right`}>{fmt(c.unsubscribed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueChart({ q, p, onTip, onLeave }: { q: QuarterReport; p: QuarterReport | null; onTip: TipFn; onLeave: () => void }) {
  const W = 560;
  const H = 220;
  const M: Margin = { t: 16, r: 8, b: 28, l: 48 };
  const max = niceMax(Math.max(...q.revenueMonthly, ...(p ? p.revenueMonthly : []), 1));
  const gw = (W - M.l - M.r) / 3;
  const ph = H - M.t - M.b;
  const bw = p ? gw * 0.26 : gw * 0.4;
  const gap = 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Revenue won by month">
      <YGrid W={W} H={H} M={M} max={max} ticks={4} show={short$} />
      {q.revenueMonthly.map((v, i) => {
        const x0 = M.l + gw * i + gw / 2 - (p ? bw + gap / 2 : bw / 2);
        const xc = p ? x0 + bw + gap : x0;
        const hc = (v / max) * ph;
        const hp = p ? (p.revenueMonthly[i] / max) * ph : 0;
        return (
          <g key={i}>
            {p && hp > 0 && <rect x={x0} y={H - M.b - hp} width={bw} height={hp} rx={4} fill={C.prev} />}
            {hc > 0 && <rect x={xc} y={H - M.b - hc} width={bw} height={hc} rx={4} fill={C.won} />}
            {v > 0 && (
              <text x={xc + bw / 2} y={H - M.b - hc - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.ink}>
                {short$(v)}
              </text>
            )}
            <text x={M.l + gw * i + gw / 2} y={H - 9} textAnchor="middle" fontSize={11} fill={C.axis}>
              {q.monthLabels[i]}
            </text>
            <rect
              x={M.l + gw * i}
              y={M.t}
              width={gw}
              height={ph}
              fill="transparent"
              onMouseMove={(e) =>
                onTip(
                  e,
                  <>
                    <b>{q.monthLabels[i]}</b>
                    <br />
                    {money(v)} won
                    {p && (
                      <>
                        <br />
                        <span className="text-secondary-300">
                          {money(p.revenueMonthly[i])} in {p.monthLabels[i]}
                        </span>
                      </>
                    )}
                  </>
                )
              }
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={C.base} />
    </svg>
  );
}
