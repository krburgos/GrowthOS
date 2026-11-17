"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { InfoTip } from "@/components/ui/info-tip";
import type { BoardMonth, BoardRow, ProgramBoardData } from "@/lib/programs/intel";
import { PROGRAM_LABEL, PROGRAM_TAB, previousMonth, shortMonth, type Program } from "@/lib/programs/programs";
import { change, show } from "@/lib/programs/tactical";
import { monthLabel } from "@/lib/sniperleads/report";

/**
 * A program's monthly report in Intel (client-confirmed 2026-11-16, approved
 * mockup "Program Reports Mockup"). Only published months exist here. The
 * header, headline band and cards follow the Intel page (reports-board.tsx)
 * so the two tabs read as one page; the Month by Month table holds every
 * number for every published month (no trend column — client direction).
 */

const CUR = "var(--color-secondary-600)";
const OTHER = "var(--color-primary-200)";
/** The Month by Month table and charts show at most this many months. */
const WINDOW = 12;

export function IntelTabs({ programs, active }: { programs: Program[]; active: "account" | Program }) {
  const tabs: { key: "account" | Program; label: string; href: string }[] = [
    { key: "account", label: "Account", href: "/reports" },
    ...programs.map((p) => ({ key: p, label: PROGRAM_LABEL[p], href: `/reports?tab=${PROGRAM_TAB[p]}` })),
  ];
  return (
    <nav aria-label="Intel reports" className="flex flex-wrap items-center gap-1 border-b border-neutral-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={`-mb-px border-b-2 px-2.5 py-2 text-body-sm sm:px-3.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 ${
            active === t.key ? "border-secondary-600 text-primary-900" : "border-transparent text-neutral-500 hover:text-primary-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
      <InfoTip
        label="About these tabs"
        text="Each CRO Leader program you subscribe to gets its own tab, with a report for every month CRO Leader has published."
        className="ml-1"
      />
    </nav>
  );
}

export function ProgramBoard({ data, selected, tabs }: { data: ProgramBoardData; selected: string | null; tabs: ReactNode }) {
  const router = useRouter();
  const [compare, setCompare] = useState(true);
  const months = data.months;
  const tab = PROGRAM_TAB[data.program];
  const label = PROGRAM_LABEL[data.program];

  const header = (picker: ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div>
        <h1 className="text-h1 text-primary-900">Intel</h1>
        <p className="text-body text-neutral-500">What CRO Leader delivered for your programs, month by month.</p>
      </div>
      {picker}
    </div>
  );

  if (months.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
        {header(null)}
        {tabs}
        <section className="rounded-xl border border-primary-100 bg-white p-10 text-center shadow-lift">
          <p className="text-h4 text-primary-900">Your first {label} report is on its way</p>
          <p className="text-body text-neutral-500">CRO Leader publishes it here once the month&apos;s numbers are in.</p>
        </section>
      </main>
    );
  }

  const idx = Math.max(0, selected ? months.findIndex((m) => m.month === selected) : months.length - 1);
  const cur = months[idx];
  const prevKey = previousMonth(cur.month);
  const prev = months.find((m) => m.month === prevKey) ?? null;
  const hasEarlier = idx > 0;
  const showPrev = compare && hasEarlier;
  const windowMonths = months.slice(Math.max(0, idx - WINDOW + 1), idx + 1);
  const defs: Record<string, BoardRow> = Object.fromEntries(data.table.flatMap((g) => g.rows).map((r) => [r.key, r]));
  const v = (k: string, m: BoardMonth | null = cur) => (m ? (m.figures[k] ?? null) : null);

  const delta = (k: string) => {
    if (!hasEarlier) return <span className="text-caption text-neutral-400">First month on record</span>;
    if (!showPrev) return <span className="text-caption">&nbsp;</span>;
    if (!prev) return <span className="text-caption text-neutral-500">No report for {shortMonth(prevKey)} to compare</span>;
    const c = change(v(k), v(k, prev), defs[k] ?? {});
    if (!c) return <span className="text-caption text-neutral-400">—</span>;
    if (c.tone === "none") return <span className="text-caption text-neutral-500">{c.text}</span>;
    const tone = c.tone === "up" ? "text-success-700" : c.tone === "down" ? "text-error-700" : "text-neutral-500";
    return (
      <span className={`text-caption font-semibold tabular-nums ${tone}`}>
        {c.arrow ? `${c.arrow} ` : ""}
        {c.text} <span className="font-normal text-neutral-400">vs {shortMonth(prevKey)}</span>
      </span>
    );
  };

  const stat = (k: string, l?: string, accent?: boolean) => (
    <div key={k} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-neutral-200 px-3.5 py-3">
      <span className="flex items-center gap-1 text-caption font-medium text-neutral-500">
        {l ?? defs[k].label}
        {defs[k].tip && <InfoTip label={`About ${l ?? defs[k].label}`} text={defs[k].tip!} />}
      </span>
      <span className={`text-h2 font-bold tabular-nums ${accent ? "text-secondary-700" : "text-primary-900"}`}>{show(v(k), defs[k].percent)}</span>
      {delta(k)}
    </div>
  );

  const picker = (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="program-month" className="sr-only">
        Month
      </label>
      <select
        id="program-month"
        value={cur.month}
        onChange={(e) => router.push(`/reports?tab=${tab}&m=${e.target.value}`)}
        className="h-10 cursor-pointer rounded-md border border-neutral-300 bg-white px-3 text-body font-semibold text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        {[...months].reverse().map((m, i) => (
          <option key={m.month} value={m.month}>
            {monthLabel(m.month)}
            {i === 0 ? " · latest" : ""}
          </option>
        ))}
      </select>
      {hasEarlier && (
        <button
          type="button"
          role="switch"
          aria-checked={compare}
          onClick={() => setCompare((c) => !c)}
          className="inline-flex items-center gap-2 rounded-md px-1 text-body-sm text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        >
          <span aria-hidden="true" className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${compare ? "bg-secondary-600" : "bg-neutral-300"}`}>
            <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${compare ? "translate-x-[14px]" : ""}`} />
          </span>
          Compare with {shortMonth(prevKey)}
        </button>
      )}
      <a
        href={cur.pdfHref}
        className="flex h-10 items-center gap-1.5 rounded-md bg-primary-700 px-3.5 text-body-sm font-semibold text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        <Download className="size-4" />
        Download PDF
      </a>
    </div>
  );

  const published = new Date(cur.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const cm = monthLabel(cur.month);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      {header(picker)}
      {tabs}
      <p className="-mt-2 text-caption text-neutral-500">
        Published by CRO Leader on {published} · Subscribed since {monthLabel(data.since)}
      </p>

      <section
        aria-label="Headline figures"
        className="rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] p-4 shadow-lift"
      >
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {data.headline.map((h) => (
            <div key={h.key} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-white px-3.5 py-3">
              <span className="flex items-center gap-1 text-caption font-medium text-neutral-500">
                {h.label}
                {defs[h.key].tip && <InfoTip label={`About ${h.label}`} text={defs[h.key].tip!} />}
              </span>
              <span className="text-h2 font-bold tabular-nums text-primary-900">{show(v(h.key), defs[h.key].percent)}</span>
              {delta(h.key)}
            </div>
          ))}
        </div>
      </section>

      {data.program === "tactical_leads" ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="MQCs Added" subtitle="Contacts researched and added to your lists, by month">
              <div className="px-5 pb-4">
                <Headline value={show(v("mqcs"))} text={`added in ${cm}`} />
                <Bars months={windowMonths} k="mqcs" selected={cur.month} />
                <Legend items={[[CUR, cm], [OTHER, "Other months"]]} />
              </div>
            </Card>
            <Card title="Email Campaigns" subtitle="Open rate by month, with this month's clicks and replies">
              <div className="px-5 pb-4">
                <Headline value={show(v("open_rate"), true)} text={`opened in ${cm} · ${show(v("emails_sent"))} emails sent`} />
                <RateLine months={windowMonths} k="open_rate" selected={cur.month} />
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {stat("click_rate")}
                  {stat("real_replies")}
                  {stat("reply_rate")}
                </div>
              </div>
            </Card>
            <Card title="Email Warmup" subtitle="How well your sending mailboxes reach the inbox">
              <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 pt-3">
                {stat("inbox_placement")}
                {stat("delivered_rate")}
                {stat("bounce_rate")}
                {stat("mailboxes_warmed")}
              </div>
            </Card>
            <Card title="Live Activity Monitoring" subtitle="Real-time alerts when a prospect engages, with the advised next step">
              <div className="grid grid-cols-1 gap-4 px-5 pb-5 pt-1 sm:grid-cols-[1fr_1.3fr]">
                <div className="flex flex-col justify-center">
                  <Headline value={show(v("alerts_sent"))} text={`alerts sent in ${cm}`} />
                  {delta("alerts_sent")}
                </div>
                <ul className="flex flex-col divide-y divide-neutral-100 text-body-sm">
                  {["alerts_opened", "alerts_clicked", "alerts_replied", "alerts_visited"].map((k) => (
                    <li key={k} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-neutral-700">{defs[k].label}</span>
                      <span className="font-semibold tabular-nums text-primary-900">{show(v(k))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
          <Card title="LinkedIn Invites & Messaging" subtitle="Invites sent from your profile, who accepted, and the conversations that followed">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,2fr)_5fr]">
              <div className="grid grid-cols-2 content-start gap-2.5 px-5 pb-5 pt-3">
                {stat("linkedin_invites")}
                {stat("linkedin_accepted")}
                {stat("acceptance_rate", undefined, true)}
                {stat("linkedin_messages")}
              </div>
              <div className="border-t border-neutral-100 px-5 pb-4 pt-3 xl:border-l xl:border-t-0">
                <Headline value={`${show(v("linkedin_replies"))} replies`} text={`on LinkedIn in ${cm}`} />
                <Bars months={windowMonths} k="linkedin_accepted" selected={cur.month} />
                <Legend items={[[CUR, `Accepted in ${cm}`], [OTHER, "Other months"]]} />
              </div>
            </div>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="From Intent to Won" subtitle="Where your SniperLeads stand">
            <div className="flex flex-col gap-2 px-5 pb-5 pt-3">
              {["flagged", "opportunities", "meetings", "proposals", "won"].map((k) => {
                const top = Math.max(v("flagged") ?? 0, 1);
                const n = v(k) ?? 0;
                return (
                  <div key={k} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-body-sm">
                    <span className="text-neutral-700">{defs[k].label}</span>
                    <span className="h-5 rounded-[4px] bg-neutral-100">
                      <span
                        className="block h-5 rounded-[4px]"
                        style={{ width: `${n > 0 ? Math.max((n / top) * 100, 2) : 0}%`, background: k === "won" ? "var(--color-success-600)" : CUR }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-primary-900">{show(v(k))}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Outreach to SniperLeads" subtitle="Emails, calls and site visits CRO Leader ran on flagged contacts">
            <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 pt-3">
              {stat("emails_sent")}
              {stat("real_replies")}
              {stat("calls", "Calls")}
              {stat("website_visits")}
            </div>
          </Card>
        </div>
      )}

      <Card title="Month by Month" subtitle="Every number for every published month">
        <div data-month-scroll className="overflow-x-auto px-5 pb-5 pt-2">
          <table className="w-full border-collapse text-body-sm" style={{ minWidth: 150 + windowMonths.length * 64 }}>
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th scope="col" className="sticky left-0 z-[1] border-r border-neutral-100 bg-white px-3 py-2.5 text-left text-caption font-semibold">
                  Deliverable
                </th>
                {windowMonths.map((m) => (
                  <th
                    key={m.month}
                    // On a narrow screen the table scrolls sideways; open it on
                    // the month being viewed rather than the oldest one.
                    ref={
                      m.month === cur.month
                        ? (el) => {
                            const box = el?.closest<HTMLElement>("[data-month-scroll]");
                            if (el && box) box.scrollLeft = Math.max(0, el.offsetLeft + el.offsetWidth - box.clientWidth + 20);
                          }
                        : undefined
                    }
                    scope="col"
                    className={`px-3 py-2.5 text-right text-caption font-semibold ${m.month === cur.month ? "bg-secondary-50 text-primary-900" : ""}`}
                  >
                    {shortMonth(m.month)}
                    {windowMonths.some((x) => x.month.slice(0, 4) !== m.month.slice(0, 4)) ? ` ${m.month.slice(2, 4)}` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.table.map((g) => (
                <GroupRows key={g.title} title={g.title} rows={g.rows} months={windowMonths} selected={cur.month} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

function GroupRows({ title, rows, months, selected }: { title: string; rows: BoardRow[]; months: BoardMonth[]; selected: string }) {
  return (
    <>
      <tr>
        <td colSpan={months.length + 1} className="px-3 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary-700">
          {title}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.key} className="border-b border-neutral-100">
          <td className="sticky left-0 z-[1] border-r border-neutral-100 bg-white px-3 py-2 text-neutral-700">
            <span className="inline-flex items-center gap-1">
              {r.label}
              {r.tip && <InfoTip label={`About ${r.label}`} text={r.tip} />}
            </span>
          </td>
          {months.map((m) => (
            <td
              key={m.month}
              className={`px-3 py-2 text-right tabular-nums ${m.month === selected ? "bg-secondary-50 font-semibold text-primary-900" : "text-neutral-700"}`}
            >
              {show(m.figures[r.key] ?? null, r.percent)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-primary-100 bg-white shadow-lift">
      <div className="px-5 pb-1 pt-4">
        <h2 className="text-h4 text-primary-900">{title}</h2>
        <p className="text-caption text-neutral-500">{subtitle}</p>
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

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-caption text-neutral-600">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px]" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

/**
 * An axis that ends on a round number with round steps (1, 2 or 5 times a
 * power of ten), at most five steps: 45 → 0/10/…/50, 296 → 0/100/200/300.
 */
function niceScale(v: number) {
  const top = Math.max(v, 1);
  let p = 1;
  for (;;) {
    for (const s of [1, 2, 5]) {
      const step = s * p;
      const n = Math.ceil(top / step);
      if (n <= 5) return { max: n * step, steps: n };
    }
    p *= 10;
  }
}

const W = 460;
const H = 190;
const M = { t: 16, r: 10, b: 26, l: 40 };

function Grid({ max, steps, fmtTick }: { max: number; steps: number; fmtTick: (n: number) => string }) {
  const ph = H - M.t - M.b;
  return (
    <g>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const y = M.t + ph * (1 - i / steps);
        return (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke="var(--color-neutral-100)" />
            <text x={M.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--color-neutral-500)">
              {fmtTick((max / steps) * i)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Bars({ months, k, selected }: { months: BoardMonth[]; k: string; selected: string }) {
  const vals = months.map((m) => m.figures[k] ?? 0);
  const { max, steps } = niceScale(Math.max(...vals, 1));
  const ph = H - M.t - M.b;
  const bw = (W - M.l - M.r) / Math.max(months.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="By month">
      <Grid max={max} steps={steps} fmtTick={(n) => Math.round(n).toLocaleString()} />
      {months.map((m, i) => {
        const on = m.month === selected;
        const val = m.figures[k];
        const h = ((val ?? 0) / max) * ph;
        const w = Math.min(bw * 0.52, 44);
        const x = M.l + bw * i + (bw - w) / 2;
        const y = M.t + ph - h;
        return (
          <g key={m.month}>
            <rect x={x} y={y} width={w} height={Math.max(h, 0)} rx={3} fill={on ? CUR : OTHER}>
              <title>{`${monthLabel(m.month)}: ${show(val ?? null)}`}</title>
            </rect>
            <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize={11} fontWeight={on ? 600 : 400} fill={on ? "var(--color-primary-900)" : "var(--color-neutral-500)"}>
              {show(val ?? null)}
            </text>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-neutral-500)">
              {shortMonth(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RateLine({ months, k, selected }: { months: BoardMonth[]; k: string; selected: string }) {
  const vals = months.map((m) => m.figures[k] ?? null);
  const { max, steps } = niceScale(Math.min(100, Math.max(...vals.map((x) => x ?? 0), 10)));
  const ph = H - M.t - M.b;
  const step = months.length > 1 ? (W - M.l - M.r - 20) / (months.length - 1) : 0;
  const pts = vals.map((x, i) => (x === null ? null : ([M.l + 10 + step * i, M.t + ph * (1 - x / max)] as const)));
  const drawn = pts.filter((p): p is readonly [number, number] => p !== null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Open rate by month">
      <Grid max={max} steps={steps} fmtTick={(n) => `${Math.round(n)}%`} />
      {months.map((m, i) => (
        <text key={m.month} x={M.l + 10 + step * i} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-neutral-500)">
          {shortMonth(m.month)}
        </text>
      ))}
      {drawn.length > 1 && (
        <polyline points={drawn.map((p) => p.join(",")).join(" ")} fill="none" stroke={CUR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {pts.map((p, i) => {
        if (!p) return null;
        const on = months[i].month === selected;
        return (
          <g key={months[i].month}>
            <circle cx={p[0]} cy={p[1]} r={on ? 5 : 3} fill={on ? CUR : "var(--color-white)"} stroke={CUR} strokeWidth={2}>
              <title>{`${monthLabel(months[i].month)}: ${show(vals[i], true)}`}</title>
            </circle>
            {on && (
              <text x={p[0]} y={p[1] - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-primary-900)">
                {show(vals[i], true)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
