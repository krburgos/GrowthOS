# ICP & List Building Mission Card workspaces — design

Date: 2026-10-23 · Approved mockup: https://claude.ai/artifact/QyjGtgHqhPE6wFKt5vKA8g (3 artboards)

## Intent

Mission Cards are becoming where the work happens (direction of 2026-10-22; Email Campaigning and SDR Outreach already converted). This converts two more:

- **Step 6 · ICP Development & Targeting Strategy** (`icp-development`)
- **Step 7 · List Building & Data Acquisition** (`list-building`)

The problem being solved: the CEO / sales manager has already answered the ICP in the Solution Questionnaire and lists already exist, but nothing tells them *what to do next* on these cards. Each card therefore gets a section that (a) shows what exists, (b) walks them through a short numbered mission, and (c) connects ICP → lists → SDR/campaigns.

## Goals

1. ICP card shows the questionnaire's ICP answers (no re-capture), lets the right people **approve** it, and shows how much of the CRM fits it.
2. List Building card shows the account's lists with **ICP fit %** and **who is working each list**, and offers **Build ICP list**, which creates a list from the approved ICP in one step.
3. Both cards carry a "Your mission on this card" step strip so a CEO knows the next action without a manual.
4. When the CRM doesn't have enough contacts, the user can do it themselves (import), assign it (Mission Order), or delegate it to GrowthMission with credits.

## Non-goals / anti-goals

- No second ICP form. Answers stay in `growth_questionnaire_responses.answers`; "Edit" links go to the questionnaire wizard step.
- No smart/live lists (removed 2026-09-06). ICP lists are ordinary static lists filled once, at creation.
- No new data vendors or enrichment integrations (SniperLeads intent data stays out).
- Approval does not block anything except Build ICP list (see Decisions). It never edits or deletes questionnaire answers.

## User decisions (2026-10-23)

| # | Question | Answer |
|---|---|---|
| 1 | Add Approve ICP? | Yes |
| 2 | Fit check + ICP fit column? | Yes |
| 3 | Who approves? | MSP Owner **and** CRO Admin — **both** must approve (confirmed) |
| 4 | "Order from GrowthMission" creates a GrowthMission Mission Order with credits? | Yes |
| 5 | Lock Build ICP list until approved? | No — it can always be used; the Lists section shows a warning banner while the ICP isn't finished/approved |
| 6 | Location not prefilled? | Fine; user may revisit |

## Where it sits

The Mission Card page (`app/(app)/(msp-shell)/growth-mission/[slug]/page.tsx`) gets one new section per card, between Hours and The Arsenal, exactly as Campaigns was added:

- `icp-development` → switcher tab **ICP Profile** (`#icp-profile`)
- `list-building` → switcher tab **Lists** (`#lists`, count = lists)

Both use the existing navy-gradient section frame (`NAVY_GRADIENT`, `border-primary-200`, `bg-primary-50` stats strip) and accept a `focusSlot`.

## Section 1 — ICP Profile (step 6)

**Header:** "Ideal Client Profile" · sub-line "From the Solution Questionnaire · last edited {updated_at}". Actions: *Edit answers* (→ questionnaire wizard at the first ICP step), *Approve ICP* (only for `msp_owner`, `cro_admin`).

Approval needs two sign-offs on the same answers: one from an MSP Owner and one from a CRO Admin. Under the header a sign-off row shows both slots ("MSP Owner — Approved by {name} · {date}" / "CRO Leader — Waiting"). The Approve button shows only to a viewer whose slot is still open. Fully approved → *Approved* badge. If ICP answers change after any sign-off: warning "Changed since approval", both slots reset (old rows kept as history).

**Mission strip (3 steps):**
1. *Review the profile* — done once the questionnaire's ICP part is complete (all `part: "icp"` questions answered).
2. *Approve it with your sales lead* — done when the current approval is not stale.
3. *Build a list from it* — done when any non-archived list has `built_from_icp`; links to the List Building card.

Current step = first not-done step (2px navy border); each step has an ⓘ tooltip, no captions.

**Stats strip (4):** Industries (`N ranked`), Company size (min–max employees from chosen buckets), Decision makers (joined), Contacts that fit (`X of Y`, tooltip).

**Profile grid (5 cards):** Target companies · Decision makers & technology · Business needs & lead type · Your MSP & messaging (span 2) · Buying-intent topics. Unanswered fields are omitted; a card with nothing answered shows "Not answered yet — Edit". Each "Edit" deep-links to its questionnaire step.

Extend `lib/vision-board/icp.ts` (`IcpAnswers` / `icpFromQuestionnaire`) with the fields it doesn't read yet (IT environment, software stack, pain points, compliance, growth stage, budget, value prop, key messages, do's & don'ts, intent topics) so Vision Board and this card keep one reading of the answers.

**Fit check band:** Industry %, Size %, Title % of active (non-archived) contacts, plus "See the N contacts" → `/contacts` with the ICP rules encoded in the address (existing `encodeRule` / `f` params).

## Section 2 — Lists (step 7)

**Header:** "Lists" · "{n} lists · {contacts} contacts · {k} ICP lists". Actions: *New list* (existing create-list flow), *Build ICP list* (opens dialog, always enabled). While the ICP is unfinished (questionnaire ICP part incomplete) or not fully approved, a warning banner sits under the header: "Your ICP isn't finished yet — lists built now may target the wrong companies. Finish the ICP →" (links to the ICP card). The dialog always reads the current answers.

**Mission strip (4 steps):** ICP approved (link to ICP card) → Build an ICP list → Clean it → Put it to work.
- *Clean it* done when no ICP list has a bounced or unsubscribed member.
- *Put it to work* done when every ICP list has an active SDR assignment or a campaign.

**Stats strip:** Contacts on lists (distinct) · Fit the ICP (distinct, with %) · To clean (bounced + unsubscribed list members) · Lists not in use.

**Table:** List (with cyan "ICP" chip when `built_from_icp`) · ICP fit (right-aligned %) · Contacts · Prospect Value (no tooltip) · Health (existing bar) · Working it (chips: `SDR · {name}` from `sdr_list_assignments`, `Campaign · {name}` from `campaigns.list_id`; warning chip "Not used" when neither) · Added. Paginated at 10 like every table; footer link "Open all lists" → `/lists`. Below `lg`, rows become cards like the Campaigns section.

## Build ICP list dialog

Navy header "Build ICP list" · "Filled in from your approved ICP". Fields:

- **List name** — default `{Industry #1} {min}–{max}` (editable).
- **Filter rows** (Where/And, same look as the Contacts filter panel), prefilled from the current ICP answers:
  - Industry *is any of* {ranked industries + Other text}
  - Employee size *is from* {min} *to* {max} (bucket edges; "Above 200" = open top)
  - Job title *contains any of* {decision makers}
  - No location row is prefilled (see Deviations); *Add filter* offers every Contacts filter field, including Company City / Company State.
- Checkbox **Leave out bounced and unsubscribed** (default on).
- **Live count** "N contacts match", plus "{M} more have no job title yet — Review them" (→ Contacts filtered to industry+size with empty title) and Prospect Value.
- **Not enough contacts?** three tiles: *Import a file* (existing list upload flow, into the new list) · *Assign a Mission Order* (→ `/growth-mission/list-building?issue=1` with type Internal) · *Order from GrowthMission* (→ same with type GrowthMission, title "Source more ICP contacts", detail pre-filled with the ICP summary). Credits apply per the existing GrowthMission order rules.
- **Create list of N** creates a static list with `built_from_icp = true` and inserts the matching contacts into `list_members`.

## Data changes (one migration, run via SQL Editor)

1. `icp_approvals` (new, insert-only history — one row per sign-off):
   `id uuid pk`, `account_id uuid not null → accounts`, `approved_by uuid not null → users`, `approver_role text not null check in ('msp_owner','cro_admin')`, `answers jsonb not null` (snapshot of the ICP keys only), `approved_at timestamptz default now()`, `archived_at timestamptz`, `created_at`.
   RLS: SELECT for the account, CRO Leader, granted partner (same as the questionnaire). INSERT only when `approved_by = auth.uid()` and either (`approver_role = 'msp_owner'` and `account_id = auth_account_id()` and role msp_owner) or (`approver_role = 'cro_admin'` and role cro_admin). No UPDATE/DELETE policies. Ends with `grant select, insert on icp_approvals to authenticated, service_role`.
   Fully approved = the latest non-archived `msp_owner` row and the latest `cro_admin` row both carry `answers` equal to the current ICP keys.
2. `lists.built_from_icp boolean not null default false` — drives the ICP chip and mission steps. No new grants needed.

Matching runs through `lib/contacts/filters.ts`: add two rule fields, **industry** (Company, *is any of*, `companies.industry ilike` each value) and **title** (Contact, *contains any of*, `contacts.title ilike %v%`). Fit percentages and counts are `count: "exact", head: true` queries with the ICP rules applied (per-list fit adds the existing `lists in` rule). All reads go browser/server → Supabase under RLS; no new API route is needed except list creation from rules, which goes through a Server Action / route that inserts the list and members in one go (multi-step → server, per Backend Schema §11).

## Deviations from the approved mockup / docs (flag to user)

- **Location is not prefilled.** The questionnaire's coverage area is free text ("60-mile radius", zips), which can't be turned into a filter reliably. The mockup showed it prefilled.
- **Industry and title match by text.** `companies.industry` and `contacts.title` are free text, so "Health Care" won't match "Healthcare", and "Chief Executive Officer" won't match "CEO" unless a small synonym list is added (builder's call: add CEO/COO/CIO/CTO spelled-out forms).
- **Docs to update when building:** App Flow (new sections on the two cards), Backend Schema (`icp_approvals`, `lists.built_from_icp`), PRD role table (approval rights).

## Left to the builder

Component split, query shape, mobile card layout, exact empty states ("No lists yet — Build ICP list"), tooltip copy refinements.
