import { Download, Pencil } from "lucide-react";
import Link from "next/link";

import { AuroraArt, FieldArt, RingArt } from "@/components/vision-board/vision-art";

type Answers = Record<string, string | string[] | null>;

export interface VisionAccount {
  id: string;
  name: string;
  logo_url: string | null;
}

/**
 * The completed Vision Board (client-confirmed, 2026-09-22, approved
 * mockup "A" — "The Vision Page"), replacing the strategy-document view
 * that listed every section in wizard order behind a sticky section list.
 *
 * The brief was that a finished board should read like a page worth
 * showing people, not a filled-in form, so it is arranged by what the
 * answers *say* rather than by which question produced them: the 10-Year
 * Target opens it, purpose and niche follow, then values, the three-year
 * picture, this year's plan, what makes the company different, the
 * numbers leadership watches, and last and most quietly, what stands in
 * the way.
 *
 * Client-confirmed decisions worth keeping visible here:
 *
 * - Headings carry the account's own name ("CRO Leader exists to…"), so
 *   the page reads as that company's rather than as a template.
 * - Unanswered fields are omitted entirely rather than printed as "Not
 *   answered". A page meant to inspire should not be a list of gaps.
 * - Obstacles and the growth barrier stay, but in the quietest band and
 *   near the end. They are real and belong on the record; they are not
 *   what the page leads with.
 * - The Ideal Customer Profile block from the old summary is dropped. It
 *   was read-only from the Solution Questionnaire and added nothing to
 *   the narrative.
 * - Not shareable outside the app — the PDF is the way it leaves. A
 *   public link would be the client portal, out of Phase 1 (PRD §10).
 *
 * Read access is account-wide, which the existing
 * vision_board_responses_select policy already grants; no policy change
 * was needed. Only the roles that may edit see "Edit".
 */
export function VisionPage({
  account,
  answers,
  canEdit,
}: {
  account: VisionAccount;
  answers: Answers;
  canEdit: boolean;
}) {
  const t = (key: string) => {
    const v = answers[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const l = (key: string) => {
    const v = answers[key];
    return Array.isArray(v) ? v.filter((item) => item.trim()) : [];
  };

  const target10 = t("target10_text");
  const purpose = t("focus_purpose");
  const niche = t("focus_niche");
  const values = l("values_list");
  const uniques = [t("unique_1"), t("unique_2"), t("unique_3")].filter(Boolean) as string[];
  const guarantee = t("guarantee_text");
  const journey = l("process_stages");
  const metrics = l("metrics_list");
  const obstacles = l("obstacles_list");
  const barrier = t("barrier_text");
  const priorities = l("plan1_priorities");

  const picture3 = [
    { k: "The team", v: t("picture3_team") },
    { k: "The clients", v: t("picture3_clients") },
    { k: "The market position", v: t("picture3_market_position") },
    { k: "Operations", v: t("picture3_operations") },
  ].filter((x) => x.v);

  const figures3 = [
    { k: "Revenue", v: t("picture3_revenue") },
    { k: "Gross profit", v: t("picture3_gross_profit") },
    { k: "Net profit", v: t("picture3_net_profit") },
    { k: "MRR", v: t("picture3_mrr") },
  ].filter((x) => x.v);

  const goals1 = [
    { k: "Revenue goal", v: t("plan1_revenue_goal") },
    { k: "Gross profit", v: t("plan1_gross_profit_goal") },
    { k: "Net profit", v: t("plan1_net_profit_goal") },
    { k: "MRR goal", v: t("plan1_mrr_goal") },
    { k: "New client acquisition", v: t("plan1_new_client_goal") },
  ].filter((x) => x.v);

  const signName = t("signoff_name");
  const signTitle = t("signoff_title");
  const signDate = t("signoff_date");

  const exportHref = `/api/vision-board/export?account_id=${account.id}`;

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_20px_40px_-28px_rgba(2,42,102,0.35)]">
      {/* ---------------- Hero ---------------- */}
      <header className="relative overflow-hidden bg-primary-950 px-6 pb-14 pt-16 text-center text-white md:px-12 md:pb-16 md:pt-20">
        <AuroraArt />
        <div className="absolute right-4 top-4 z-20 flex gap-2 md:right-6 md:top-6">
          {canEdit && (
            <Link
              href="/settings/vision-board?edit=1"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-body-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <Pencil className="size-4" />
              Edit
            </Link>
          )}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-body-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Download className="size-4" />
            Export PDF
          </a>
        </div>

        <div className="relative z-10">
          {/* A wide plate sized to the logo, not a square that crops it —
              a company wordmark is usually far wider than it is tall. */}
          <div className="mb-8 flex justify-center">
            {account.logo_url ? (
              <span className="inline-flex h-12 items-center rounded-lg bg-white/95 px-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={account.logo_url} alt={account.name} className="max-h-7 w-auto max-w-[200px] object-contain" />
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-h4 font-bold">
                {account.name}
              </span>
            )}
          </div>
          <Eyebrow tone="dark">Where {account.name} is going — ten years out</Eyebrow>
          {target10 && (
            <h1 className="mx-auto max-w-[34ch] text-balance text-display font-semibold leading-tight tracking-tight">
              {target10}
            </h1>
          )}
          {(signName || signDate) && (
            <p className="mt-7 text-body-sm text-white/50">
              {[signName, signTitle, signDate].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      {/* ---------------- Purpose & niche ---------------- */}
      {(purpose || niche) && (
        <Band>
          {/* Label in its own rail so both statements start at the same left
              edge, and neither is squeezed into a column too narrow for its
              own type size. */}
          {purpose && (
            <Statement label={`${account.name} exists to`}>
              <p className="max-w-[54ch] text-h3 font-medium leading-relaxed text-neutral-800">{purpose}</p>
            </Statement>
          )}
          {niche && (
            <div className={purpose ? "mt-10 border-t border-neutral-200 pt-9" : ""}>
              <Statement label="And does this better than most">
                <p className="max-w-[54ch] text-h3 font-medium leading-relaxed text-neutral-800">{niche}</p>
              </Statement>
            </div>
          )}
        </Band>
      )}

      {/* ---------------- Core values ---------------- */}
      {values.length > 0 && (
        <Band tone="navy">
          <Eyebrow tone="dark">What {account.name} will not compromise</Eyebrow>
          <h2 className="text-h1 font-semibold tracking-tight">Core values</h2>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, i) => (
              <div
                key={value}
                className="relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-xl px-6 pb-6 pt-7"
                style={{ background: VALUE_GRADIENTS[i % VALUE_GRADIENTS.length] }}
              >
                <RingArt index={i} />
                <span className="relative z-10 text-caption font-bold tracking-[0.14em] text-secondary-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="relative z-10 mt-1.5 text-h2 font-bold tracking-tight">{value}</p>
              </div>
            ))}
          </div>
        </Band>
      )}

      {/* ---------------- 3-year picture ---------------- */}
      {(figures3.length > 0 || picture3.length > 0) && (
        <Band tone="deep">
          <Eyebrow tone="dark">Three years from today</Eyebrow>
          <h2 className="max-w-[34ch] text-balance text-h1 font-semibold leading-tight tracking-tight">
            This is what {account.name} looks like.
          </h2>
          {figures3.length > 0 && (
            <dl className="mt-8 grid grid-cols-1 border-y border-white/15 sm:grid-cols-2 lg:grid-cols-4">
              {figures3.map((f, i) => (
                <div
                  key={f.k}
                  className={`px-5 py-6 ${i > 0 ? "border-t border-white/15 sm:border-t-0 lg:border-l" : ""} ${
                    i > 0 && i % 2 === 1 ? "sm:border-l sm:border-white/15" : ""
                  }`}
                >
                  <dt className="text-caption font-semibold uppercase tracking-[0.1em] text-white/50">{f.k}</dt>
                  <dd
                    className={`mt-1.5 text-display font-bold leading-none tracking-tight tabular-nums ${
                      i === 0 ? "text-secondary-300" : "text-white"
                    }`}
                  >
                    {f.v}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {picture3.length > 0 && (
            <dl className="mt-8 grid grid-cols-1 gap-x-9 gap-y-5 sm:grid-cols-2">
              {picture3.map((p) => (
                <div key={p.k}>
                  <dt className="mb-1.5 text-caption font-semibold uppercase tracking-[0.1em] text-white/50">{p.k}</dt>
                  <dd className="text-body-lg leading-relaxed text-white/90">{p.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Band>
      )}

      {/* ---------------- 1-year plan ---------------- */}
      {(goals1.length > 0 || priorities.length > 0) && (
        <Band>
          <Eyebrow>The next twelve months</Eyebrow>
          <h2 className="text-h1 font-semibold tracking-tight text-primary-900">
            What has to be true a year from now.
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-9 lg:grid-cols-[1.1fr_1fr]">
            {goals1.length > 0 && (
              <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {goals1.map((g, i) => (
                  <div
                    key={g.k}
                    className={`rounded-xl border border-neutral-200 px-4 py-4 ${
                      i === goals1.length - 1 && goals1.length % 2 === 1 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <dt className="text-caption font-semibold uppercase tracking-wide text-neutral-400">{g.k}</dt>
                    <dd className="mt-0.5 text-h1 font-bold tracking-tight tabular-nums text-primary-900">{g.v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {priorities.length > 0 && (
              <div>
                <Eyebrow>Priorities</Eyebrow>
                <ol className="mt-1">
                  {priorities.map((p, i) => (
                    <li key={p} className="flex items-start gap-3.5 border-b border-neutral-200 py-3.5">
                      <span className="pt-1 text-caption font-bold tracking-[0.06em] text-secondary-700">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-body-lg font-medium text-neutral-800">{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Band>
      )}

      {/* ---------------- The difference ---------------- */}
      {(uniques.length > 0 || guarantee || journey.length > 0) && (
        <Band tone="tint">
          <Eyebrow>Why clients choose {account.name}</Eyebrow>
          <h2 className="text-h1 font-semibold tracking-tight text-primary-900">The {account.name} difference</h2>

          {uniques.length > 0 && (
            <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-3">
              {uniques.map((u, i) => (
                <div key={u} className="border-t-[3px] border-secondary-500 pt-4">
                  <span className="text-caption font-bold uppercase tracking-[0.14em] text-secondary-700">
                    Unique {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-h3 font-medium leading-relaxed text-neutral-800">{u}</p>
                </div>
              ))}
            </div>
          )}

          {guarantee && (
            <div className="relative mt-9 overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-secondary-800))] px-7 py-7 text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[70px] -right-[50px] size-[220px] rounded-full border-[1.5px]"
                style={{ borderColor: "color-mix(in srgb, var(--color-secondary-300) 25%, transparent)" }}
              />
              <Eyebrow tone="dark">Our guarantee</Eyebrow>
              <p className="relative z-10 max-w-[42ch] text-balance text-h2 font-semibold leading-snug tracking-tight">{guarantee}</p>
            </div>
          )}

          {journey.length > 0 && (
            <div className="mt-9">
              <Eyebrow>How a client journey runs</Eyebrow>
              <ol className="flex flex-wrap items-center gap-y-2">
                {journey.map((stage, i) => (
                  <li key={stage} className="flex items-center">
                    <span className="rounded-full border border-neutral-200 bg-white px-5 py-2 text-body font-semibold text-primary-900">
                      {stage}
                    </span>
                    {i < journey.length - 1 && (
                      <span aria-hidden="true" className="px-2.5 text-h3 text-neutral-300">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Band>
      )}

      {/* ---------------- Metrics ---------------- */}
      {metrics.length > 0 && (
        <Band compact>
          <Eyebrow>What leadership watches every week</Eyebrow>
          <ul className="flex flex-wrap gap-2.5">
            {metrics.map((m) => (
              <li
                key={m}
                className="rounded-full border border-secondary-200 bg-secondary-100 px-5 py-2 text-body-lg font-semibold text-secondary-800"
              >
                {m}
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ---------------- What stands in the way ---------------- */}
      {(obstacles.length > 0 || barrier) && (
        <Band tone="deep" art={<FieldArt />}>
          <Eyebrow tone="dark">Said plainly</Eyebrow>
          <h2 className="max-w-[34ch] text-balance text-h1 font-semibold leading-tight tracking-tight">
            What stands between here and there.
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-9 lg:grid-cols-2">
            {obstacles.length > 0 && (
              <div>
                <Eyebrow tone="dark">Obstacles</Eyebrow>
                <ul>
                  {obstacles.map((o) => (
                    <li key={o} className="flex items-start gap-3 border-b border-white/10 py-3 text-body-lg leading-relaxed text-white/90">
                      <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-warning-400" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {barrier && (
              <div className="border-l-[3px] border-warning-400 pl-5">
                <Eyebrow tone="dark">The one barrier to doubling</Eyebrow>
                <p className="max-w-[46ch] text-h3 font-medium leading-relaxed text-white">{barrier}</p>
              </div>
            )}
          </div>
        </Band>
      )}

      {/* ---------------- Sign-off ---------------- */}
      {/* No signature block here: the hero credits it now, and saying it
          twice on one page reads as a mistake rather than emphasis. */}
      <footer className="flex flex-wrap items-center justify-end gap-5 border-t border-neutral-200 bg-neutral-50 px-6 py-6 md:px-12">
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href="/settings/vision-board?edit=1"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3.5 py-2 text-body-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <Pencil className="size-4" />
              Edit
            </Link>
          )}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3.5 py-2 text-body-sm font-semibold text-white hover:bg-primary-800"
          >
            <Download className="size-4" />
            Export PDF
          </a>
        </div>
      </footer>
    </article>
  );
}

const VALUE_GRADIENTS = [
  "linear-gradient(160deg, var(--color-primary-800), var(--color-primary-900))",
  "linear-gradient(160deg, var(--color-secondary-800), var(--color-primary-900))",
  "linear-gradient(160deg, var(--color-primary-700), var(--color-secondary-800))",
];

function Eyebrow({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <p
      className={`mb-4 text-caption font-semibold uppercase tracking-widest ${
        tone === "dark" ? "text-secondary-300" : "text-secondary-700"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * A statement with its label in a narrow rail to the left (client-confirmed
 * mockup "B" for the purpose band): the label stops sitting on top of the
 * sentence, and every statement in the band starts at the same left edge.
 * The rail collapses above the statement on a narrow screen.
 */
function Statement({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-9 gap-y-3 md:grid-cols-[minmax(150px,1fr)_minmax(0,3fr)]">
      <p className="border-t-2 border-secondary-500 pt-3 text-caption font-semibold uppercase tracking-widest text-secondary-700">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Band({
  tone = "white",
  compact,
  art,
  children,
}: {
  tone?: "white" | "tint" | "navy" | "deep";
  compact?: boolean;
  art?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ground =
    tone === "navy"
      ? "bg-primary-900 text-white"
      : tone === "deep"
        ? "bg-primary-950 text-white"
        : tone === "tint"
          ? "bg-neutral-50"
          : "bg-white";
  return (
    <section className={`relative overflow-hidden px-6 md:px-12 ${compact ? "py-9" : "py-12 md:py-14"} ${ground}`}>
      {art}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
