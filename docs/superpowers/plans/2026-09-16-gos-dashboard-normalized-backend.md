# GOS Dashboard Normalized Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded sample data behind the GOS Dashboard (`lib/gos-dashboard/playbook.ts`) with a normalized, per-account, per-step Postgres schema that the CRO Leader team can manually edit, while keeping the 14 steps' static shape (title, icon, phase, duties, whether a step gets the SEO/GEO 3-tab treatment) as app code — the same "structure in code, data in DB" split already used for the Growth Questionnaire and Vision Board.

**Architecture:** Five new tables, one row per `(account_id, step_slug)` (or per item, for the list-shaped data), read-scoped the same way as every other tenant table (own account, CRO Leader, granted partner) but **write-scoped to CRO Admin/Advisor only** — the MSP and everyone else gets read-only, since this is CRO Leader's own service-delivery tracking, not something the MSP fills in. Reads go straight from Server Components (hybrid access, no secret involved); the new edit UI writes directly from the browser via RLS, same pattern as `vision-board-wizard.tsx`.

**Tech Stack:** Postgres enums + tables via Supabase migration (MCP `apply_migration`), Next.js Server Components for reads, a new client component for CRO-Leader-only editing, `@supabase/supabase-js` browser client for writes. No new npm dependencies.

**Spec:** No separate spec doc exists yet — this plan is the spec, built from `docs/GrowthOS Playbook - Dev Plan.docx` (the 14 steps' Duties/KPIs), the existing mockup (`lib/gos-dashboard/playbook.ts`, `app/(app)/(msp-shell)/gos-dashboard/**`, `components/gos-dashboard/**`), and this conversation's decisions. Once built, `docs/backend-schema.md` and `docs/app-flow.md` get amended to absorb it (Task 7), same as every other "client-confirmed addition" in this repo.

## Global Constraints

- **No automated test suite (Tech Stack Lockfile §3.9, Implementation Plan §19).** Every "verify" step below is a Supabase SQL check, `tsc --noEmit`, or a manual browser check — not a Vitest/Playwright test file. Do not add a test framework to satisfy this plan's TDD-shaped skill template.
- **Soft delete everywhere, no DELETE RLS policies (CLAUDE.md non-negotiable).** The four list-shaped tables (KPIs, status-report stats, suggestions, tracker items) get an `archived_at` column instead of real deletes; "removing" a row in the edit UI sets `archived_at`, never `DELETE FROM`.
- **Every tenant-scoped table carries `account_id`** and its own RLS policies — no relying on a join to a parent table for tenant scoping.
- **Hybrid data access (Backend Schema §11):** this is simple CRUD with no secrets — reads in Server Components, writes direct from the browser client under RLS. No new API route.
- **Design tokens only from `docs/design-system.md` §9** — reuse the existing success/warning/secondary color families already used by `components/gos-dashboard/status-badge.tsx`, don't invent new ones.
- **Flag, don't silently decide:** the write-role matrix below (CRO Admin/Advisor only) is this plan's biggest assumption. Task 1 is the point of no return for it — confirm before applying that migration for real.

---

## Assumptions & Open Items (confirm before Task 1)

1. **Write access = `cro_admin`, `cro_advisor` only.** `cro_service_team` and `partner` get read-only here, same as they get read-only on Contacts/Opportunities/etc. today (`lib/auth/nav-permissions.ts`) — even though the Playbook doc itself names "CRO Leader Team" against several steps. If service-team members actually need to enter data (not just CRO Admin/Advisor), the RLS write policies in Task 1 need `auth_has_any_role('cro_admin','cro_advisor','cro_service_team')` instead.
2. **MSP roles are read-only**, full stop — no `msp_owner`/`msp_admin` write parity (unlike the Questionnaire/Vision Board). If the MSP should be able to self-report anything (e.g. confirm a KPI number), that changes the insert/update policies in Task 1.
3. **The 14 step identities stay in app code** (`lib/gos-dashboard/playbook.ts`), not a `playbook_steps` DB table — matches how `lib/questionnaire/questions.ts` and `lib/vision-board/sections.ts` work. If CRO Leader wants to add a 15th step or edit step titles/duties themselves without a code deploy, that needs a real reference table instead (bigger change, not in this plan).
4. **No reordering UI for KPI/suggestion/tracker rows** — they display in insertion order (`created_at asc`). No `sort_order` column, per YAGNI; add one later if drag-reordering is actually requested.

---

## Task 1: Migration — enums, 5 tables, RLS

**Files:**
- Create: `supabase/migrations/20260917000001_gos_dashboard_data.sql`

**Interfaces:**
- Produces: Postgres enum types `gos_dashboard_step` (14 values, matching the `slug` strings in `lib/gos-dashboard/playbook.ts` exactly), `gos_dashboard_status` (`on_track`/`ahead`/`needs_attention`, matching `PlaybookStatus`), `gos_dashboard_priority` (`high`/`medium`/`low`, matching `SuggestionItem.priority`). Tables: `gos_dashboard_step_status`, `gos_dashboard_kpis`, `gos_dashboard_status_report_stats`, `gos_dashboard_suggestions`, `gos_dashboard_tracker_items` — every later task's queries and RLS assumptions depend on the exact column names below.

- [ ] **Step 1: Write the migration file**

```sql
-- GOS Dashboard manual data entry (client-confirmed addition, 2026-09-16).
-- Replaces the mockup's hardcoded per-account fields (lib/gos-dashboard/
-- playbook.ts) with real per-account data the CRO Leader team enters.
-- Step identity (title/icon/phase/duties/whether a step gets the SEO/GEO
-- 3-tab shape) stays in app code, same reasoning as growth_questionnaire_
-- responses and vision_board_responses — only the CRO-Leader-entered
-- values below live in the DB.
--
-- Write access is CRO Admin/Advisor only (open item #1 in the plan this
-- migration ships with — confirm before relying on this). MSP roles get
-- read-only, the inverse of the Questionnaire/Vision Board pattern,
-- because this is CRO Leader's own service-delivery tracking, not
-- something the MSP fills in themselves.

create type gos_dashboard_step as enum (
  'seo', 'geo', 'blogging-content', 'social-media', 'website-oversight',
  'icp-development', 'list-building', 'email-campaigning', 'crm-administration',
  'pipeline-metrics', 'reviews-testimonials', 'events', 'sdr-outreach', 'sales-enablement'
);

create type gos_dashboard_status as enum ('on_track', 'ahead', 'needs_attention');

create type gos_dashboard_priority as enum ('high', 'medium', 'low');

-- One row per account per step: the card's status pill + headline stat,
-- plus (SEO/GEO only, nullable for the other 12) the status report
-- narrative summary.
create table gos_dashboard_step_status (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  status gos_dashboard_status not null default 'on_track',
  headline_label text,
  headline_value text,
  status_report_summary text,
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, step_slug)
);
create index gos_dashboard_step_status_account_id_idx on gos_dashboard_step_status(account_id);

create table gos_dashboard_kpis (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  value text not null,
  target text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_kpis_account_step_idx on gos_dashboard_kpis(account_id, step_slug);

-- SEO/GEO's Status Report tab stat row(s) — a different list than the
-- KPIs grid at the bottom of the same step (the doc shows both).
create table gos_dashboard_status_report_stats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  value text not null,
  target text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_status_report_stats_account_step_idx on gos_dashboard_status_report_stats(account_id, step_slug);

create table gos_dashboard_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  title text not null,
  priority gos_dashboard_priority not null default 'medium',
  detail text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_suggestions_account_step_idx on gos_dashboard_suggestions(account_id, step_slug);

create table gos_dashboard_tracker_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  step_slug gos_dashboard_step not null,
  label text not null,
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_dashboard_tracker_items_account_step_idx on gos_dashboard_tracker_items(account_id, step_slug);

alter table gos_dashboard_step_status enable row level security;
alter table gos_dashboard_kpis enable row level security;
alter table gos_dashboard_status_report_stats enable row level security;
alter table gos_dashboard_suggestions enable row level security;
alter table gos_dashboard_tracker_items enable row level security;

-- Read: same three-way pattern as every other tenant table (own account,
-- any CRO Leader role, a granted partner). Write: CRO Admin/Advisor only
-- (open item #1) — no msp_owner/msp_admin bypass, deliberately.
create policy gos_dashboard_step_status_select on gos_dashboard_step_status for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_step_status_write on gos_dashboard_step_status for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_step_status_update on gos_dashboard_step_status for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_kpis_select on gos_dashboard_kpis for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_kpis_write on gos_dashboard_kpis for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_kpis_update on gos_dashboard_kpis for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_status_report_stats_select on gos_dashboard_status_report_stats for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_status_report_stats_write on gos_dashboard_status_report_stats for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_status_report_stats_update on gos_dashboard_status_report_stats for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_suggestions_select on gos_dashboard_suggestions for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_suggestions_write on gos_dashboard_suggestions for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_suggestions_update on gos_dashboard_suggestions for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create policy gos_dashboard_tracker_items_select on gos_dashboard_tracker_items for select
  using (account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id));
create policy gos_dashboard_tracker_items_write on gos_dashboard_tracker_items for insert
  with check (auth_has_any_role('cro_admin', 'cro_advisor'));
create policy gos_dashboard_tracker_items_update on gos_dashboard_tracker_items for update
  using (auth_has_any_role('cro_admin', 'cro_advisor'));

create trigger trg_gos_dashboard_step_status_updated_at before update on gos_dashboard_step_status
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_kpis_updated_at before update on gos_dashboard_kpis
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_status_report_stats_updated_at before update on gos_dashboard_status_report_stats
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_suggestions_updated_at before update on gos_dashboard_suggestions
  for each row execute function set_updated_at();
create trigger trg_gos_dashboard_tracker_items_updated_at before update on gos_dashboard_tracker_items
  for each row execute function set_updated_at();
```

- [ ] **Step 2: Apply the migration**

Use the `mcp__supabase__apply_migration` tool with `name: "gos_dashboard_data"` and the SQL above as `query` — not a raw `execute_sql` call, since this is DDL.

- [ ] **Step 3: Verify the tables and enums exist**

Run via `mcp__supabase__execute_sql`:
```sql
select table_name from information_schema.tables where table_name like 'gos_dashboard_%';
select typname from pg_type where typname like 'gos_dashboard_%';
```
Expected: 5 table names, 3 type names.

- [ ] **Step 4: Verify RLS with `get_advisors`**

Run `mcp__supabase__get_advisors` with `type: "security"`. Expected: no new findings beyond the pre-existing ones already present before this migration (function `search_path`, `pg_net` in public schema, security-definer functions, leaked-password-protection — all unrelated to this table).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260917000001_gos_dashboard_data.sql
git commit -m "Add GOS Dashboard normalized backend schema (enums, 5 tables, RLS)"
```

---

## Task 2: Split static shape from per-account data in `lib/gos-dashboard/`

**Files:**
- Modify: `lib/gos-dashboard/playbook.ts` — strip out `status`, `headline`, `kpis`, `dashboard` from `PlaybookStep` (those become per-account DB data); keep `slug`, `number`, `phase`, `title`, `icon`, `responsible`, `budgetNote`, `duties`, and a new boolean `hasDashboardShape`.
- Create: `lib/gos-dashboard/queries.ts` — server-side reads, merging the static shape with DB rows.

**Interfaces:**
- Consumes: Task 1's 5 tables and 3 enum types.
- Produces:
  - `PLAYBOOK_STEPS: PlaybookShape[]` (renamed/narrowed from today's `PlaybookStep[]`) — `interface PlaybookShape { slug: string; number: number; phase: 1|2|3|4; title: string; icon: IconKey; responsible?: string; budgetNote?: string; duties: string[]; hasDashboardShape: boolean }`.
  - `getStepOverviews(accountId: string): Promise<StepOverview[]>` — one per `PLAYBOOK_STEPS` entry, `interface StepOverview extends PlaybookShape { status: PlaybookStatus; headline: KpiStat | null }`, `status` defaults to `"needs_attention"` and `headline` to `null` when no `gos_dashboard_step_status` row exists yet for that step.
  - `getStepDetail(accountId: string, slug: string): Promise<StepDetail | undefined>` — `interface StepDetail extends StepOverview { kpis: KpiStat[]; statusReportSummary: string | null; statusReportStats: KpiStat[]; suggestions: SuggestionItem[]; tracker: TrackerItem[] }`, empty arrays/`null` when nothing entered yet.

- [ ] **Step 1: Narrow `PlaybookStep` to `PlaybookShape` in `lib/gos-dashboard/playbook.ts`**

Remove `status`, `headline`, `kpis`, `dashboard` from the interface and from all 14 entries in `PLAYBOOK_STEPS`; add `hasDashboardShape: true` to the `seo` and `geo` entries only, omit it (defaults to `false` via `?? false` at read time) elsewhere. Keep `getPlaybookStep`/`getPhaseName` as-is — they still operate on shape data.

- [ ] **Step 2: Write `lib/gos-dashboard/queries.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import {
  PLAYBOOK_STEPS,
  type KpiStat,
  type PlaybookShape,
  type PlaybookStatus,
  type SuggestionItem,
  type TrackerItem,
} from "@/lib/gos-dashboard/playbook";

export interface StepOverview extends PlaybookShape {
  status: PlaybookStatus;
  headline: KpiStat | null;
}

export interface StepDetail extends StepOverview {
  kpis: KpiStat[];
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: SuggestionItem[];
  tracker: TrackerItem[];
}

export async function getStepOverviews(accountId: string): Promise<StepOverview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gos_dashboard_step_status")
    .select("step_slug, status, headline_label, headline_value")
    .eq("account_id", accountId);

  const bySlug = new Map((data ?? []).map((row) => [row.step_slug, row]));

  return PLAYBOOK_STEPS.map((shape) => {
    const row = bySlug.get(shape.slug);
    return {
      ...shape,
      status: (row?.status as PlaybookStatus) ?? "needs_attention",
      headline:
        row?.headline_label && row?.headline_value
          ? { label: row.headline_label, value: row.headline_value }
          : null,
    };
  });
}

export async function getStepDetail(accountId: string, slug: string): Promise<StepDetail | undefined> {
  const shape = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  if (!shape) return undefined;

  const supabase = await createClient();
  const [{ data: statusRow }, { data: kpiRows }, { data: statRows }, { data: suggestionRows }, { data: trackerRows }] =
    await Promise.all([
      supabase
        .from("gos_dashboard_step_status")
        .select("status, headline_label, headline_value, status_report_summary")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .maybeSingle(),
      supabase
        .from("gos_dashboard_kpis")
        .select("label, value, target")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_status_report_stats")
        .select("label, value, target")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_suggestions")
        .select("title, priority, detail")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_tracker_items")
        .select("label, percent_complete")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
    ]);

  return {
    ...shape,
    status: (statusRow?.status as PlaybookStatus) ?? "needs_attention",
    headline:
      statusRow?.headline_label && statusRow?.headline_value
        ? { label: statusRow.headline_label, value: statusRow.headline_value }
        : null,
    kpis: (kpiRows ?? []).map((r) => ({ label: r.label, value: r.value, target: r.target ?? undefined })),
    statusReportSummary: statusRow?.status_report_summary ?? null,
    statusReportStats: (statRows ?? []).map((r) => ({ label: r.label, value: r.value, target: r.target ?? undefined })),
    suggestions: (suggestionRows ?? []).map((r) => ({
      title: r.title,
      priority: r.priority as SuggestionItem["priority"],
      detail: r.detail ?? "",
    })),
    tracker: (trackerRows ?? []).map((r) => ({ label: r.label, percentComplete: r.percent_complete })),
  };
}
```

- [ ] **Step 3: `tsc --noEmit` and fix fallout**

Run: `npx tsc --noEmit -p .`
Expected: errors in `components/gos-dashboard/playbook-card.tsx`, `components/gos-dashboard/step-header.tsx`, `components/gos-dashboard/playbook-detail-tabs.tsx`, and both `app/(app)/(msp-shell)/gos-dashboard/**/page.tsx` files, since they still import the old `PlaybookStep` shape with `status`/`headline`/`kpis`/`dashboard` inline — expected, fixed in Tasks 3–4, not this task. Confirm the *only* errors are in those files (nowhere else), so the split itself is otherwise clean.

- [ ] **Step 4: Commit**

```bash
git add lib/gos-dashboard/playbook.ts lib/gos-dashboard/queries.ts
git commit -m "Split GOS Dashboard static shape from per-account query layer"
```

---

## Task 3: Wire the GOS Dashboard list page to live data

**Files:**
- Modify: `app/(app)/(msp-shell)/gos-dashboard/page.tsx` — call `getStepOverviews`, pass `StepOverview[]` instead of `PLAYBOOK_STEPS` to the grid.
- Modify: `components/gos-dashboard/playbook-card.tsx` — accept `StepOverview` (`headline` now nullable).

**Interfaces:**
- Consumes: `getStepOverviews` from Task 2.
- Produces: `PlaybookCard` now renders an honest empty state (`"Not started yet"`, neutral-400 text) in the headline slot when `headline` is `null`, instead of assuming a value always exists.

- [ ] **Step 1: Update `PlaybookCard`'s prop type and empty state**

Replace the `headline` block in `components/gos-dashboard/playbook-card.tsx`:
```typescript
<div className="mt-auto flex items-baseline justify-between border-t border-neutral-100 pt-3">
  <div>
    {step.headline ? (
      <>
        <p className="text-h4 font-bold tabular-nums text-primary-900">{step.headline.value}</p>
        <p className="text-caption text-neutral-500">{step.headline.label}</p>
      </>
    ) : (
      <p className="text-caption text-neutral-400">Not started yet</p>
    )}
  </div>
  <span className="shrink-0 text-body-sm font-semibold text-secondary-700 group-hover:underline">View →</span>
</div>
```
Update the `step` prop's type import to `StepOverview` from `@/lib/gos-dashboard/queries`.

- [ ] **Step 2: Update the page to fetch live data**

```typescript
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getStepOverviews } from "@/lib/gos-dashboard/queries";

export default async function GosDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;
  const steps = await getStepOverviews(user.account_id);

  return (
    // ...unchanged JSX, just map over `steps` instead of `PLAYBOOK_STEPS`
  );
}
```
Remove the now-unused `PLAYBOOK_STEPS` import.

- [ ] **Step 3: `tsc --noEmit`, then manual browser check**

Run: `npx tsc --noEmit -p .` — expected: this file and `playbook-card.tsx` now clean; remaining errors confined to the detail page/components (Task 4).
Manual check: start the dev server, log in as `owner@prosper-solutions.com`, open `/gos-dashboard`. Expected: all 14 cards render with "Not started yet" (no `gos_dashboard_step_status` rows exist yet) instead of a crash.

- [ ] **Step 4: Commit**

```bash
git add app/"(app)"/"(msp-shell)"/gos-dashboard/page.tsx components/gos-dashboard/playbook-card.tsx
git commit -m "Wire GOS Dashboard list page to live per-account data"
```

---

## Task 4: Wire the Step Detail page to live data

**Files:**
- Modify: `app/(app)/(msp-shell)/gos-dashboard/[slug]/page.tsx` — call `getStepDetail`, `notFound()` if `undefined`.
- Modify: `components/gos-dashboard/step-header.tsx` — accept `StepDetail` (`headline` unused here, no change needed beyond the type import).
- Modify: `components/gos-dashboard/playbook-detail-tabs.tsx` — accept the flattened `StepDetail` fields instead of a nested `dashboard` object; add empty states for each of the 3 tabs.
- Modify: `components/gos-dashboard/kpi-grid.tsx` — accept `kpis: KpiStat[]`, render `"No KPIs added yet"` (neutral-400, centered, matching the Design System §8.11 empty-state pattern) when the array is empty.
- Modify: `components/gos-dashboard/duties-list.tsx` — unchanged (duties are still static shape data).

**Interfaces:**
- Consumes: `getStepDetail` and `StepDetail` from Task 2.
- Produces: the detail page now renders correctly with zero rows in every table (new account, nothing entered yet) — this is the state every real account will be in until Task 5/6 ship, so it must not look broken.

- [ ] **Step 1: Update `PlaybookDetailTabs` to take flattened props and add empty states**

Change the signature from `{ dashboard }: { dashboard: NonNullable<PlaybookStep["dashboard"]> }` to:
```typescript
export function PlaybookDetailTabs({
  statusReportSummary,
  statusReportStats,
  suggestions,
  tracker,
}: {
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: SuggestionItem[];
  tracker: TrackerItem[];
}) {
```
In the "Status Report" tab body, wrap the summary paragraph: `{statusReportSummary ? <p ...>{statusReportSummary}</p> : <p className="text-body-sm text-neutral-400">No status report yet.</p>}`. In "Suggestions & Fixes" and "Progress Tracker", render `<p className="text-body-sm text-neutral-400">Nothing added yet.</p>` when the respective array is empty, matching `duties-list.tsx`'s plain-list style rather than inventing a new empty-state component.

- [ ] **Step 2: Update `KpiGrid` for the empty case**

```typescript
export function KpiGrid({ kpis }: { kpis: KpiStat[] }) {
  if (kpis.length === 0) {
    return <p className="text-body-sm text-neutral-400">No KPIs added yet.</p>;
  }
  return (
    // ...unchanged grid JSX
  );
}
```

- [ ] **Step 3: Update the detail page**

```typescript
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getStepDetail } from "@/lib/gos-dashboard/queries";

export default async function GosDashboardStepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;
  const step = await getStepDetail(user.account_id, slug);
  if (!step) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 md:p-8">
      <StepHeader step={step} />
      {step.hasDashboardShape && (
        <PlaybookDetailTabs
          statusReportSummary={step.statusReportSummary}
          statusReportStats={step.statusReportStats}
          suggestions={step.suggestions}
          tracker={step.tracker}
        />
      )}
      <div>
        <h2 className="mb-3 text-h4 text-primary-900">Duties</h2>
        <DutiesList duties={step.duties} />
      </div>
      <div>
        <h2 className="mb-3 text-h4 text-primary-900">KPIs</h2>
        <KpiGrid kpis={step.kpis} />
      </div>
    </main>
  );
}
```
Remove `generateStaticParams` (it listed all 14 slugs for a fully-static mock page; now that the page reads per-account DB data, it must render dynamically — leaving `generateStaticParams` in would try to statically prerender pages that need a logged-in user's `account_id`, which doesn't exist at build time).

- [ ] **Step 4: `tsc --noEmit`, then manual browser check**

Run: `npx tsc --noEmit -p .` — expected: zero errors anywhere in `app/` or `components/gos-dashboard/`.
Manual check: open `/gos-dashboard/seo` and `/gos-dashboard/blogging-content` as `owner@prosper-solutions.com`. Expected: SEO shows the 3 tabs each with their "nothing yet" empty state; Blogging shows Duties + "No KPIs added yet" only (no tabs, since `hasDashboardShape` is false for it).

- [ ] **Step 5: Commit**

```bash
git add app/"(app)"/"(msp-shell)"/gos-dashboard/"[slug]"/page.tsx components/gos-dashboard/playbook-detail-tabs.tsx components/gos-dashboard/kpi-grid.tsx
git commit -m "Wire GOS Dashboard step detail page to live per-account data"
```

---

## Task 5: CRO Leader edit UI — overview + KPIs (all 14 steps)

**Files:**
- Create: `components/gos-dashboard/edit-overview-panel.tsx` — client component, status select + headline label/value inputs, save button.
- Create: `components/gos-dashboard/edit-kpi-list.tsx` — client component, add/edit/remove KPI rows (label/value/target), adapted from `ListFieldInput` in `components/settings/vision-board-wizard.tsx` but with 3 text fields per row instead of 1.
- Modify: `app/(app)/(msp-shell)/gos-dashboard/[slug]/page.tsx` — pass `canEdit` (`user.role === "cro_admin" || user.role === "cro_advisor"`) down to the new panels; render them instead of the plain display when `canEdit` is true.

**Interfaces:**
- Consumes: `StepDetail` from Task 2; the browser Supabase client (`createClient` from `@/lib/supabase/client`, same import `vision-board-wizard.tsx` uses).
- Produces: `EditOverviewPanel({ accountId, stepSlug, initialStatus, initialHeadline, canEdit }: {...})` and `EditKpiList({ accountId, stepSlug, initialKpis, canEdit }: {...})` — both self-contained (own `useState`, own save-to-Supabase call), so the detail page just conditionally renders read vs. edit version without owning any form state itself.

- [ ] **Step 1: Write `EditOverviewPanel`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { STATUS_LABEL, type KpiStat, type PlaybookStatus } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS: PlaybookStatus[] = ["on_track", "ahead", "needs_attention"];

export function EditOverviewPanel({
  accountId,
  stepSlug,
  initialStatus,
  initialHeadline,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialStatus: PlaybookStatus;
  initialHeadline: KpiStat | null;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [headlineLabel, setHeadlineLabel] = useState(initialHeadline?.label ?? "");
  const [headlineValue, setHeadlineValue] = useState(initialHeadline?.value ?? "");
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <StatusBadge status={status} />;
  }

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("gos_dashboard_step_status").upsert(
      {
        account_id: accountId,
        step_slug: stepSlug,
        status,
        headline_label: headlineLabel || null,
        headline_value: headlineValue || null,
      },
      { onConflict: "account_id,step_slug" }
    );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Saved.");
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
      <div>
        <label className="text-caption font-semibold text-neutral-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PlaybookStatus)}
          className="block h-9 rounded-md border border-neutral-300 px-2 text-body-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-caption font-semibold text-neutral-600">Headline label</label>
        <Input value={headlineLabel} onChange={(e) => setHeadlineLabel(e.target.value)} className="w-48" />
      </div>
      <div>
        <label className="text-caption font-semibold text-neutral-600">Headline value</label>
        <Input value={headlineValue} onChange={(e) => setHeadlineValue(e.target.value)} className="w-32" />
      </div>
      <Button onClick={save} disabled={saving} size="sm">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `EditKpiList`**

Same immediate-persist pattern as `components/settings/statuses-manager.tsx` (no separate Save button — each add/remove writes straight to Supabase), adapted from `ListFieldInput`'s add/remove-row shape in `components/settings/vision-board-wizard.tsx:69-139` but with 3 fields per row instead of 1:

```typescript
"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { KpiStat } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { KpiGrid } from "@/components/gos-dashboard/kpi-grid";

interface KpiRow extends KpiStat {
  id: string;
}

export function EditKpiList({
  accountId,
  stepSlug,
  initialKpis,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialKpis: (KpiStat & { id: string })[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<KpiRow[]>(initialKpis);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");

  if (!canEdit) {
    return <KpiGrid kpis={rows} />;
  }

  const add = async () => {
    if (!label.trim() || !value.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_kpis")
      .insert({ account_id: accountId, step_slug: stepSlug, label, value, target: target || null })
      .select("id, label, value, target")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => [...prev, { id: data.id, label: data.label, value: data.value, target: data.target ?? undefined }]);
    setLabel("");
    setValue("");
    setTarget("");
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_kpis")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="relative rounded-lg border border-neutral-200 bg-white p-3.5">
            <button
              type="button"
              aria-label="Remove"
              onClick={() => remove(row.id)}
              className="absolute right-2 top-2 text-neutral-400 hover:text-error-700"
            >
              <X className="size-3.5" />
            </button>
            <p className="text-h4 font-bold tabular-nums text-primary-900">{row.value}</p>
            <p className="mt-0.5 text-caption text-neutral-500">{row.label}</p>
            {row.target && <p className="mt-1 text-caption font-medium text-secondary-700">Target: {row.target}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-40" />
        <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className="w-28" />
        <Input placeholder="Target (optional)" value={target} onChange={(e) => setTarget(e.target.value)} className="w-40" />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Add KPI
        </Button>
      </div>
    </div>
  );
}
```

Note this requires `getStepDetail` (Task 2) to select and return each KPI row's `id`, not just `label`/`value`/`target` — go back and add `id` to the `KpiStat` returned for `StepDetail.kpis` specifically (`StepOverview.headline` and `statusReportStats` stay id-less, they're never individually removable): in `lib/gos-dashboard/queries.ts`, change the `kpis` select to `"id, label, value, target"` and the map to include `id: r.id`, and widen `StepDetail`'s `kpis` field type to `(KpiStat & { id: string })[]`.

- [ ] **Step 3: Wire both into the detail page behind `canEdit`**

Give `StepHeader` (`components/gos-dashboard/step-header.tsx`) an optional render slot instead of hardcoding `StatusBadge`:
```typescript
export function StepHeader({ step, overviewSlot }: { step: PlaybookShape; overviewSlot: React.ReactNode }) {
  // ...unchanged JSX, except the existing `<StatusBadge status={step.status} />` line becomes:
  {overviewSlot}
}
```
In `app/(app)/(msp-shell)/gos-dashboard/[slug]/page.tsx`:
```typescript
const canEdit = user.role === "cro_admin" || user.role === "cro_advisor";

return (
  <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 md:p-8">
    <StepHeader
      step={step}
      overviewSlot={
        <EditOverviewPanel
          accountId={user.account_id}
          stepSlug={step.slug}
          initialStatus={step.status}
          initialHeadline={step.headline}
          canEdit={canEdit}
        />
      }
    />
    {step.hasDashboardShape && (
      <PlaybookDetailTabs
        statusReportSummary={step.statusReportSummary}
        statusReportStats={step.statusReportStats}
        suggestions={step.suggestions}
        tracker={step.tracker}
      />
    )}
    <div>
      <h2 className="mb-3 text-h4 text-primary-900">Duties</h2>
      <DutiesList duties={step.duties} />
    </div>
    <div>
      <h2 className="mb-3 text-h4 text-primary-900">KPIs</h2>
      {canEdit ? (
        <EditKpiList accountId={user.account_id} stepSlug={step.slug} initialKpis={step.kpis} canEdit={canEdit} />
      ) : (
        <KpiGrid kpis={step.kpis} />
      )}
    </div>
  </main>
);
```

- [ ] **Step 4: `tsc --noEmit`, then manual browser check as both roles**

Run: `npx tsc --noEmit -p .` — expected clean.
Manual check: log in as `vharrison@croleader.com` (`cro_admin`), enter the CRO Leader dashboard, "enter" the Prosper Solutions account, open `/gos-dashboard/seo`, change status to "Ahead of Schedule," add a KPI row, save, refresh — value persists. Then log in as `owner@prosper-solutions.com` (`msp_owner`) and confirm the same page shows the updated status/KPI as read-only (no inputs, no Save button).

- [ ] **Step 5: Commit**

```bash
git add components/gos-dashboard/edit-overview-panel.tsx components/gos-dashboard/edit-kpi-list.tsx app/"(app)"/"(msp-shell)"/gos-dashboard/"[slug]"/page.tsx components/gos-dashboard/step-header.tsx
git commit -m "Add CRO Leader edit UI for GOS Dashboard status and KPIs"
```

---

## Task 6: CRO Leader edit UI — status report, suggestions, tracker (SEO/GEO only)

**Files:**
- Modify: `lib/gos-dashboard/queries.ts` — `getStepDetail`'s `suggestions` and `tracker` arrays need each row's `id` (same reasoning as Task 5's KPI `id` amendment — `statusReportStats` does NOT need `id`, since this task never makes individual stat rows removable, only the summary text as a whole). Select `"id, title, priority, detail"` for suggestions and `"id, label, percent_complete"` for tracker items; widen `StepDetail.suggestions` to `(SuggestionItem & { id: string })[]` and `StepDetail.tracker` to `(TrackerItem & { id: string })[]`.
- Modify: `components/gos-dashboard/playbook-detail-tabs.tsx` — add `accountId`, `stepSlug`, `canEdit` props; each tab renders an edit affordance instead of the plain display when `canEdit` is true.
- Modify: `app/(app)/(msp-shell)/gos-dashboard/[slug]/page.tsx` — pass `accountId`, `stepSlug`, `canEdit` through to `PlaybookDetailTabs`.

**Interfaces:**
- Consumes: `canEdit` from Task 5; the `id`-bearing `StepDetail.suggestions`/`StepDetail.tracker` this task adds to Task 2's queries.
- Produces: `PlaybookDetailTabs` now takes `{ accountId: string; stepSlug: string; statusReportSummary: string | null; statusReportStats: KpiStat[]; suggestions: (SuggestionItem & { id: string })[]; tracker: (TrackerItem & { id: string })[]; canEdit: boolean }` — the `statusReportSummary`/`statusReportStats` fields are unchanged from Task 4, `suggestions`/`tracker` are now the widened, `id`-bearing shape, and `accountId`/`stepSlug`/`canEdit` are new.

- [ ] **Step 1: Add summary editing to the Status Report tab**

Inside `PlaybookDetailTabs`, seed local state from the `statusReportSummary` prop and render a `textarea` + "Save" button in place of the plain paragraph when `canEdit`:
```typescript
function EditableSummary({
  accountId,
  stepSlug,
  initialSummary,
}: {
  accountId: string;
  stepSlug: string;
  initialSummary: string | null;
}) {
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_step_status")
      .update({ status_report_summary: summary || null })
      .eq("account_id", accountId)
      .eq("step_slug", stepSlug);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Saved.");
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="h-24 w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-body-sm"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <Button type="button" size="sm" onClick={save} disabled={saving} className="self-end">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
```
In the "Status Report" tab body, replace Task 4's ternary (`{statusReportSummary ? <p ...>{statusReportSummary}</p> : <p ...>No status report yet.</p>}`) with: `{canEdit ? <EditableSummary accountId={accountId} stepSlug={stepSlug} initialSummary={statusReportSummary} /> : statusReportSummary ? <p ...>{statusReportSummary}</p> : <p className="text-body-sm text-neutral-400">No status report yet.</p>}`. Read-only viewers keep seeing exactly Task 4's rendering, now nested under the new condition's `else` branch.

- [ ] **Step 2: Add row add/remove to Suggestions & Fixes and Progress Tracker tabs**

Same immediate-persist pattern as `EditKpiList` (Task 5, Step 2: insert on add, `archived_at` update on remove, no batch Save). In the "Suggestions & Fixes" tab, when `canEdit`, render each existing row with a remove (×) button (`onClick` → `supabase.from("gos_dashboard_suggestions").update({ archived_at: new Date().toISOString() }).eq("id", row.id)`, then filter it out of local state) and an add-row form below the list with 3 inputs — title (`Input`), priority (`<select>` of `high`/`medium`/`low`), detail (`Input`) — whose submit does `supabase.from("gos_dashboard_suggestions").insert({ account_id: accountId, step_slug: stepSlug, title, priority, detail }).select("id, title, priority, detail").single()` and appends the returned row to local state. In the "Progress Tracker" tab, same shape but 2 inputs (label `Input`, percent a `<input type="number" min={0} max={100}>`) writing to `gos_dashboard_tracker_items` with `percent_complete` instead of `value`/`target`. Both tabs keep their existing read-only rendering (progress bar / suggestion card) when `!canEdit`.

- [ ] **Step 3: Update the detail page call site**

In `app/(app)/(msp-shell)/gos-dashboard/[slug]/page.tsx`, add the 3 new props to the existing `<PlaybookDetailTabs>` call (already present from Task 4/5): `accountId={user.account_id}`, `stepSlug={step.slug}`, `canEdit={canEdit}` alongside the existing `statusReportSummary`/`statusReportStats`/`suggestions`/`tracker` props.

- [ ] **Step 4: `tsc --noEmit`, then manual browser check**

Run: `npx tsc --noEmit -p .` — expected clean.
Manual check: as `cro_admin`, add a suggestion and a tracker row to SEO, refresh, confirm both persist and the tracker bar renders at the entered percentage; remove one of each and confirm it disappears after refresh too (soft-deleted, not just hidden client-side — re-check via `mcp__supabase__execute_sql` that the row still exists with `archived_at` set, not gone). As `msp_owner`, confirm the same tab shows the surviving rows read-only, no add/remove controls.

- [ ] **Step 5: Commit**

```bash
git add lib/gos-dashboard/queries.ts components/gos-dashboard/playbook-detail-tabs.tsx app/"(app)"/"(msp-shell)"/gos-dashboard/"[slug]"/page.tsx
git commit -m "Add CRO Leader edit UI for GOS Dashboard status report, suggestions, and tracker"
```

---

## Task 7: Docs and manual QA

**Files:**
- Modify: `docs/backend-schema.md` — new `### 6.6c gos_dashboard_*` section (same style as `6.6a`/`6.6b`), documenting the 5 tables, the write-role deviation from the Questionnaire/Vision Board pattern, and that step identity stays app-code.
- Modify: `docs/app-flow.md` §4.3a — replace "mockup only" language with a description of the real read/write split (CRO Admin/Advisor edit, everyone else view), matching how §4.3a already documents the mockup version, amended in place rather than duplicated.

**Interfaces:**
- Consumes: nothing — this is documentation only.
- Produces: nothing consumed elsewhere; this is the terminal task.

- [ ] **Step 1: Write the `docs/backend-schema.md` section**

Follow the exact structure of `### 6.6b vision_board_responses` — a paragraph of context, a fenced SQL block (copy Task 1's `CREATE TABLE`/policy statements verbatim, trimmed of comments), then a closing paragraph. Explicitly call out: "Unlike `growth_questionnaire_responses` and `vision_board_responses`, write access here is CRO Admin/Advisor only — the MSP account gets read-only, since this tracks CRO Leader's own service delivery, not something the MSP self-reports (client-confirmed 2026-09-16)."

- [ ] **Step 2: Amend `docs/app-flow.md` §4.3a**

Change the opening "Client-confirmed addition (2026-09-16), mockup only" paragraph's final sentence from describing no backend to: "Client-confirmed amendment (2026-09-16): now backed by a real per-account schema (Backend Schema §6.6c) — CRO Admin/Advisor can edit every step's status, KPIs, and (SEO/GEO) status report/suggestions/tracker; every other role, MSP included, is read-only." Leave the rest of §4.3a (card layout, flat grid, tab shape for SEO/GEO) unchanged — still accurate.

- [ ] **Step 3: Manual QA pass**

Walk the full matrix once end to end in the browser: `msp_owner`, `msp_read_only`, `cro_admin`, `cro_advisor`, `cro_service_team` each opening `/gos-dashboard` and one detail page. Confirm: only `cro_admin`/`cro_advisor` see any edit controls; everyone else sees identical read-only rendering to what Tasks 3–4 shipped; no role sees a 500 or a blank crash.

- [ ] **Step 4: Commit**

```bash
git add docs/backend-schema.md docs/app-flow.md
git commit -m "Document GOS Dashboard normalized backend in Backend Schema and App Flow"
```
