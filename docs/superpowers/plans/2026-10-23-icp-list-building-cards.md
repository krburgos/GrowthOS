# ICP & List Building Mission Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Mission Card step 6 (`icp-development`) an "ICP Profile" section with two-signature approval and a fit check, and step 7 (`list-building`) a "Lists" section with ICP fit, "Working it", a not-finished warning and a Build ICP list dialog.

**Architecture:** Server components read everything under RLS (same as the Campaigns/SDR sections); client components do the two writes directly to Supabase (an `icp_approvals` insert, and list + `list_members` inserts — the same pattern `list-form.tsx` and `add-to-list-dialog.tsx` already use). ICP→filter translation lives in one pure module and feeds the existing Contacts rule engine (`applyRules`/`ruleEmbeds`), so fit counts, the dialog count and "See the N contacts" all match exactly.

**Tech Stack:** Next.js App Router, Supabase (RLS), Tailwind v4 tokens, lucide-react, existing `components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-10-23-icp-list-building-cards-design.md` · Mockup: https://claude.ai/artifact/QyjGtgHqhPE6wFKt5vKA8g

## Global Constraints

- No automated tests (CLAUDE.md / Tech Stack Lockfile §3.9). Every task verifies with `npx tsc --noEmit` and `npm run lint`; the last task runs `npm run build` and a Chrome check (desktop + phone width) as the test CRO Admin.
- No new dependencies.
- Tokens only from `app/globals.css` `@theme`; section frame copies `campaigns-workspace.tsx` (`NAVY_GRADIENT`, `border-primary-200`, `bg-primary-50` stats strip, `HEAD` class).
- Explanations go in `InfoTip` tooltips, not captions. Prospect Value gets no tooltip.
- Numbers right-aligned with `tabular-nums` under right-aligned headers.
- Soft delete only; `icp_approvals` has no UPDATE/DELETE policy. New table migration ends with `grant ... to authenticated, service_role`.
- Migrations are run by the user in the Supabase SQL Editor; verify afterwards with a read (`execute_sql` select).
- Approval = one `msp_owner` sign-off **and** one `cro_admin` sign-off on identical ICP answers.
- Build ICP list is never disabled; the Lists section warns while the ICP is incomplete or not fully approved.
- Location is not prefilled.
- Every code comment that records a client decision cites "client-confirmed, 2026-10-23, approved mockup \"ICP & List Building Cards\"".

## Review Focus

1. **Account with no ICP answers** (no questionnaire row, or ICP part blank): both sections render with empty states; `icpRules` returns `[]`; the dialog shows "Answer the ICP first" and **Create list is disabled when there are no rules** — it must never put every contact on a list.
2. **Answers edited after one sign-off**: that sign-off reads as stale, both slots show "Waiting", "Changed since approval" shows; signing again inserts a new row.
3. **Values with commas / parentheses** (e.g. industry "SLED (State, Local and Education)", Other text): split into values *before* `clean()`, so they never break a PostgREST `or()` filter.
4. **Contacts without a company or with a non-numeric size**: count toward "no match" for industry/size, never crash a count query.
5. **More than 1,000 matching contacts**: Create list pages through ids (1,000 per request) and inserts members in chunks of 500 (`chunk()` from `lib/contacts/bulk-actions.ts`), up to the 5,000 cap; above 5,000 the dialog says "Only the first 5,000 are added".

---

### Task 1: Migration — `icp_approvals` and `lists.built_from_icp`

**Files:**
- Create: `supabase/migrations/20261023000001_icp_approvals.sql`

**Interfaces:**
- Produces: table `icp_approvals(id, account_id, approved_by, approver_role, answers jsonb, approved_at, archived_at, created_at)`; column `lists.built_from_icp boolean not null default false`.

- [ ] **Step 1: Write the migration.** Columns exactly as spec "Data changes". `approver_role text not null check (approver_role in ('msp_owner','cro_admin'))`. Index `(account_id, approver_role, approved_at desc) where archived_at is null`. RLS select: `account_id = auth_account_id() or is_cro_leader() or is_partner_for(account_id)`. RLS insert `with check`: `approved_by = auth.uid() and ((approver_role = 'msp_owner' and account_id = auth_account_id() and auth_has_any_role('msp_owner')) or (approver_role = 'cro_admin' and auth_has_any_role('cro_admin')))`. `grant select, insert on icp_approvals to authenticated, service_role;` Then `alter table lists add column built_from_icp boolean not null default false;`
- [ ] **Step 2: Hand the SQL to the user** with the SQL Editor link; after they run it, verify: `select column_name from information_schema.columns where table_name in ('icp_approvals','lists') and column_name in ('approver_role','built_from_icp');` → 2 rows.
- [ ] **Step 3: Commit** `git add supabase/migrations/20261023000001_icp_approvals.sql && git commit -m "Add icp_approvals and lists.built_from_icp"`

### Task 2: ICP reading + rules (pure logic) and two new Contacts filter fields

**Files:**
- Modify: `lib/vision-board/icp.ts` (extend `IcpAnswers` / `icpFromQuestionnaire`)
- Create: `lib/icp/rules.ts`
- Modify: `lib/contacts/filters.ts` (fields `industry`, `title`)

**Interfaces:**
- Produces (`lib/vision-board/icp.ts`): `IcpAnswers` gains `itEnvironment: string[]`, `softwareStack: string|null`, `painPoints: string|null`, `compliance: string|null`, `growthStage: string|null`, `budget: string|null`, `valueProp: string|null`, `keyMessages: string|null`, `dosDonts: string|null`, `intentTopics: string[]`. Existing callers unchanged.
- Produces (`lib/icp/rules.ts`):
  - `ICP_KEYS: string[]` — every question key in `QUESTIONNAIRE_STEPS` with `part: "icp"` plus `*_other`/detail keys, plus `overview_target_market`.
  - `icpSnapshot(answers: Record<string, unknown>): Record<string, unknown>` — only `ICP_KEYS`, keys sorted, empty values dropped.
  - `sameSnapshot(a: unknown, b: unknown): boolean` — `JSON.stringify` of both snapshots equal.
  - `icpComplete(answers): boolean` — every `part: "icp"` question answered (reuse the wizard's "answered" test from `lib/questionnaire/questions.ts` if exported; else non-empty string / non-empty array).
  - `sizeRange(buckets: string[]): { from: number | null; to: number | null }` — bucket edges from `["Less than 10"→1–10, "11-20", "21-35", "36-75", "76-200", "Above 200"→201–∞]`; min of lows, max of highs (`to: null` when "Above 200" chosen).
  - `TITLE_SYNONYMS: Record<string, string[]>` — `CEO: ["CEO","Chief Executive"]`, `COO: ["COO","Chief Operating"]`, `CIO: ["CIO","Chief Information"]`, `CTO: ["CTO","Chief Technology"]`, `Owner: ["Owner","Founder","President"]`, `"IT Director": ["IT Director","Director of IT"]`.
  - `icpRules(icp: IcpAnswers): ContactRule[]` — up to three rules: `{field:"industry", op:"any", value: industries (+industriesOther) joined "|"}`, `{field:"employees", op:"between", from, to}`, `{field:"title", op:"any", value: decision makers expanded by TITLE_SYNONYMS joined "|"}`; a rule is left out when its answer is empty.
  - `icpDefaultListName(icp): string` — `${industries[0] ?? "ICP"} ${from}–${to}` (`${from}+` when open-ended).
- Produces (`lib/contacts/filters.ts`): `RuleField` gains `"industry" | "title"`. `FIELDS.industry = { label: "Industry", group: "Company", kind: "text", ops: [{value:"any", label:"is any of"}] }`, `FIELDS.title = { label: "Job title", group: "Contact", kind: "text", ops: [{value:"any", label:"contains any of"}] }`. Values separated by `|` (the panel's text input also accepts commas: split on `/[|,]/`).

- [ ] **Step 1: Extend `icpFromQuestionnaire`** with the ten fields (keys: `icp_it_environment` (+`_other`), `icp_software_stack`, `icp_pain_points`, `icp_compliance`, `icp_growth_stage`, `icp_budget`, `icp_value_prop`, `icp_key_messages`, `icp_dos_donts`, `icp_intent_topics`).
- [ ] **Step 2: Add the filter fields.** `ruleEmbeds`: `industry` → `,${a}:companies!inner(id)`. `applyRules`: split value on `/[|,]/`, `clean()` each, drop empties; `industry` → `q.or(parts.map(p => \`industry.ilike.%${p}%\`).join(","), { referencedTable: a })`; `title` → `q.or(parts.map(p => \`title.ilike.%${p}%\`).join(","))`. `describeRule`: for op `any`, `[def.label, \`${opLabel} ${parts.join(", ")}\`]`. Check the industry `.or` with `referencedTable` returns only inner-joined matches (curl the PostgREST URL against prod with the anon key + a test user JWT, per memory "Ambiguous PostgREST embeds").
- [ ] **Step 3: Write `lib/icp/rules.ts`** per the interface above.
- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint` → no errors. Open `/contacts`, add Industry "Healthcare|Legal" and Job title "CEO" rules → chips read "Industry is any of Healthcare, Legal"; count changes.
- [ ] **Step 5: Commit** `git commit -am "ICP rules and Industry/Job title contact filters"` (add `lib/icp/rules.ts`).

### Task 3: Shared list rows + card queries

**Files:**
- Create: `lib/lists/rows.ts` (moved from `app/(app)/(msp-shell)/lists/page.tsx` lines ~49–135)
- Modify: `app/(app)/(msp-shell)/lists/page.tsx` (call it)
- Create: `lib/icp/queries.ts`

**Interfaces:**
- Produces (`lib/lists/rows.ts`): `getListRows(supabase: SupabaseClient, accountId: string): Promise<{ rows: ListRow[]; contactIds: string[]; listedValue: number; unsubTotal: number }>` — exact current behaviour, plus `built_from_icp` selected onto each row. `ListRow` (in `components/lists/lists-table.tsx`) gains `built_from_icp: boolean`.
- Produces (`lib/icp/queries.ts`):
  ```ts
  export interface IcpSignoff { role: "msp_owner" | "cro_admin"; name: string; at: string; current: boolean }
  export interface IcpState {
    icp: IcpAnswers; rules: ContactRule[]; answers: Record<string, unknown>;
    updatedAt: string | null; complete: boolean;
    signoffs: { msp_owner: IcpSignoff | null; cro_admin: IcpSignoff | null };
    approved: boolean;            // both current
    changedSinceApproval: boolean; // any latest sign-off not current
  }
  export async function getIcpState(accountId: string): Promise<IcpState>
  export interface IcpFit { total: number; industry: number; size: number; title: number; all: number }
  export async function getIcpFit(accountId: string, rules: ContactRule[]): Promise<IcpFit>
  export interface WorkingIt { kind: "sdr" | "campaign"; label: string }
  export interface ListsCard {
    rows: (ListRow & { icpFit: number | null; workingIt: WorkingIt[] })[];
    distinctContacts: number; fitContacts: number; toClean: number; unused: number; icpLists: number;
  }
  export async function getListsCard(accountId: string, rules: ContactRule[]): Promise<ListsCard>
  ```
  `getIcpFit`: one `count: "exact", head: true` query per rule alone and one with all rules (base: contacts, account, `archived_at is null`); with no rules, all four are 0. `getListsCard`: `icpFit` = count of (list member ∧ all rules) / memberCount, `null` when no rules or empty list; `workingIt` from `sdr_list_assignments` (non-archived, user `full_name`) and `campaigns` (`name`, by `list_id`); `toClean` = Σ unsubscribed + bounced over `built_from_icp` lists; `unused` = lists with empty `workingIt`; `fitContacts` = distinct listed contacts matching all rules.

- [ ] **Step 1: Move the row code into `getListRows`** and switch the Lists page to it; the page must render identically.
- [ ] **Step 2: Write `lib/icp/queries.ts`.** Sign-off names come from `users(full_name)` embed on `approved_by` (curl-check the embed; name the FK if HTTP 300).
- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint`; `/lists` still shows the same numbers as before the move.
- [ ] **Step 4: Commit** `git commit -am "Share list rows; ICP state, fit and lists-card queries"`

### Task 4: Mission steps strip + ICP Profile section

**Files:**
- Create: `components/growth-mission/mission-steps.tsx`
- Create: `components/icp/icp-profile.tsx` (server-safe, receives data)
- Create: `components/icp/approve-icp-button.tsx` (client)
- Modify: `components/lists/lists-table.tsx` (export `Health`)

**Interfaces:**
- Produces: `MissionSteps({ steps }: { steps: { label: string; done: boolean; tip?: string; href?: string; hrefLabel?: string }[] })` — the "Your mission on this card" band from the mockup; current = first not done (2px `primary-700` border, number on `primary-700`); done = `success-400` circle with check; later = neutral circle. Grid columns = steps count on `md+`, stacked below.
- Produces: `IcpProfile({ state, fit, viewerRole, viewerId, accountId, focusSlot }: { state: IcpState; fit: IcpFit; viewerRole: UserRole; viewerId: string; accountId: string; focusSlot?: ReactNode })`, section `id="icp-profile"`.
- Produces: `ApproveIcpButton({ accountId, role, answers }: { accountId: string; role: "msp_owner" | "cro_admin"; answers: Record<string, unknown> })` — inserts `{ account_id, approved_by: user.id, approver_role: role, answers: icpSnapshot(answers) }`, toast "ICP approved", `router.refresh()`.

- [ ] **Step 1: `MissionSteps`** matching the mockup markup (`bg-primary-50` band, `text-caption font-bold uppercase text-primary-700` label "Your mission on this card", `InfoTip` per step).
- [ ] **Step 2: `IcpProfile`** per spec section 1 and mockup artboard 1: header (Edit answers → `/settings/growth-questionnaire?step=icp_target`; Approve button only when `viewerRole` is `msp_owner` or `cro_admin` and that slot isn't current); a sign-off row under the header with two slots ("MSP Owner" / "CRO Leader": "Approved by {name} · {Mon D}" or "Waiting"), plus a warning badge "Changed since approval" when `changedSinceApproval`; steps = Review (`complete`), Approve (`approved`), Build a list (`hasIcpList`, link `/growth-mission/list-building`); 4-stat strip; 5 profile cards (unanswered fields omitted; empty card → "Not answered yet" + Edit; each Edit → `?step=<step key>`); Fit check band with three bars and "See the {all} contacts" → `/contacts?` + `rules.map(r => "f=" + encodeURIComponent(encodeRule(r))).join("&")`. `hasIcpList` is a prop: `hasIcpList: boolean`.
- [ ] **Step 3: `ApproveIcpButton`.**
- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint`.
- [ ] **Step 5: Commit** `git commit -m "ICP Profile section and Mission steps strip"` (add the new files).

### Task 5: Lists section + Build ICP list dialog

**Files:**
- Create: `components/lists/lists-workspace.tsx` (client)
- Create: `components/lists/build-icp-list-dialog.tsx` (client)

**Interfaces:**
- Consumes: `ListsCard`, `IcpState` (Task 3), `MissionSteps` (Task 4), `icpRules`, `icpDefaultListName` (Task 2), `applyRules`, `ruleEmbeds`, `chunk`.
- Produces: `ListsWorkspace({ card, icp, accountId, canEdit, focusSlot })` (section `id="lists"`); `BuildIcpListDialog({ open, onOpenChange, accountId, icp })`.

- [ ] **Step 1: `ListsWorkspace`** per spec section 2 / artboard 2: header with New list (`/lists/new`) and Build ICP list; warning banner (`bg-warning-50 border-warning-300`, text `warning-900`) when `!icp.complete || !icp.approved`: "Your ICP isn't finished yet — lists built now may target the wrong companies." + link "Finish the ICP" → `/growth-mission/icp-development`; steps = ICP approved / Build an ICP list (`icpLists > 0`) / Clean it (`icpLists > 0 && toClean === 0`) / Put it to work (`icpLists > 0` and every ICP list has `workingIt`); 4 stats; table with columns List (+`ICP` chip) · ICP fit · Contacts · Prospect Value · Health · Working it · Added, sortable like Campaigns, 10 per page with `LocalPaginationBar`, cards below `lg`; footer "Open all lists" → `/lists`. Empty: "No lists yet. Use Build ICP list to make your first one."
- [ ] **Step 2: `BuildIcpListDialog`** per spec / artboard 3: name input (default `icpDefaultListName`), editable rule rows reusing the Contacts filter row editor if it is exported from `contacts-filter-panel.tsx` (export the row component if needed; do not duplicate it), "Leave out bounced and unsubscribed" checkbox (adds rules `bounced is no` + `subscribed is yes`), live count (debounced 300ms `count: "exact", head: true` query), "{M} more have no job title yet — Review them" (count with industry+size rules and `title is null`, link to `/contacts` with those rules), Prospect Value not needed in the dialog beyond the mockup line if cheap, else omit; three tiles: Import a file → `/lists/upload`, Assign a Mission Order → `/growth-mission/list-building?issue=1&type=internal&title=Source%20more%20ICP%20contacts`, Order from GrowthMission → same with `type=growthmission`. Create: disabled when no rules or count 0; insert `lists { account_id, name, created_by, built_from_icp: true }`, page ids 1,000 at a time up to 5,000, upsert members in chunks of 500, toast "Created {name} with {n} contacts", `router.refresh()`.
- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit** `git commit -m "Lists section and Build ICP list dialog"`.

### Task 6: Wire into the Mission Card page, deep links, order prefill, docs

**Files:**
- Modify: `app/(app)/(msp-shell)/growth-mission/[slug]/page.tsx`
- Modify: `app/(app)/(msp-shell)/settings/growth-questionnaire/page.tsx`, `components/settings/growth-questionnaire-wizard.tsx` (`initialStepKey?: string`)
- Modify: `components/growth-mission/mission-orders.tsx`, `components/growth-mission/order-panel.tsx` (`initialType`, `initialTitle`)
- Modify: `docs/app-flow.md`, `docs/backend-schema.md`, `docs/product-requirements.md`

- [ ] **Step 1: Page wiring.** Constants `ICP_SLUG = "icp-development"`, `LIST_BUILDING_SLUG = "list-building"`. For either slug, fetch `getIcpState`; ICP card also `getIcpFit` and `hasIcpList`; List Building also `getListsCard(accountId, state.rules)`. Sections after Hours: `{ view: "icp", label: "ICP Profile", hash: "#icp-profile" }` / `{ view: "lists", label: "Lists", hash: "#lists", count }`. `canEdit` for lists = the Lists page's `EDIT_ROLES`.
- [ ] **Step 2: Questionnaire deep link.** Page reads `searchParams.step`; wizard starts at the index of that step key (fallback 0).
- [ ] **Step 3: Order prefill.** Page reads `type` (`internal|outsourced|growthmission`) and `title`; MissionOrders passes them to the new-order panel; `draftFor(null, …)` uses them when given.
- [ ] **Step 4: Docs.** App Flow §4.3 (two new card sections), Backend Schema (`icp_approvals`, `lists.built_from_icp`, Industry/Job title filter fields), PRD role table (ICP approval: MSP Owner + CRO Admin, both required). Each entry cites client-confirmed 2026-10-23.
- [ ] **Step 5: Verify** `npx tsc --noEmit && npm run lint && npm run build` → success.
- [ ] **Step 6: Commit and push** `git commit -am "ICP and List Building Mission Card workspaces" && git push` (Vercel deploys main).
- [ ] **Step 7: Live check in Chrome** (test CRO Admin, desktop + 390px): both cards render; Review Focus 1–5 behave as listed; approve as CRO Admin → slot shows approved, Lists banner still shows until MSP Owner signs; build a list → appears with ICP chip and fit 100%; Order from GrowthMission opens the order panel with type GrowthMission. Screenshot each changed page.
