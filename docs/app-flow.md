> **GROWTHOS** App Flow Document — Phase 1: Navigation, Screens & User Journeys
# GrowthOS App Flow Document

Companion to the GrowthOS Product Requirements Document · Draft v1 · Phase 1 scope only


## 1. Purpose & How to Read This Document

The PRD defines _what_ GrowthOS must do. This document defines _how it's arranged and moved through_: every screen, what's on it in every state (populated, empty, loading, error), and how a user gets from one place to another.
Three sections carry the actual content:
- **§3 Site Map** — every screen in one table, so nothing gets built without a plan for it
- **§4 Screen-by-Screen Specifications** — one entry per screen: purpose, layout, key elements, and its states
- **§5 User Journeys** — the eight flows confirmed with the client, written as step-by-step paths with decision points
Journeys and cross-screen flows are written as **arrow chains** (Screen A → action → Screen B) rather than boxes-and-arrows diagrams — this reads the same in Word, PDF, and print, and every step still names the exact screen it lands on. §6 consolidates the repeating patterns (empty states, error states, loading, confirmations) into one reference table instead of restating them on every screen.
**Scope note.** Per the PRD, Phase 1 is the MSP-side CRM plus a lighter CRO Leader admin surface. This document covers both at that same relative depth: full detail for MSP screens, structural detail for the CRO Leader dashboard.

## 2. Global Navigation & Application Shell


### 2.1 Layout

Every authenticated screen shares one shell: a **left sidebar** for primary navigation and a **persistent top bar**. Only the content area to the right of the sidebar and below the top bar changes between screens. **Client-confirmed addition:** while inside Settings specifically, one or two extra docked panels appear between the sidebar and the content area — a drill-down (My Profile vs. Account Settings, then Account Settings' own sub-areas) rather than a flat list. See Design System §8.9 for the exact levels. No other section has this in Phase 1.
**Left sidebar — top-level items (MSP view):**
- Dashboard
- Contacts _(prospects and contacts are one merged section — see §4.4)_
- Opportunities
- Lists
- Campaigns
- Reports
- Settings
**Top bar — left to right:**
- GrowthOS logo (click → Dashboard)
- Contacts search box _(search is scoped to Contacts only, not global — see §2.3)_
- Notifications bell
- User/account menu (profile, log out)
**CRO Leader "viewing as" mode** replaces nothing in this shell — it adds one element: a full-width banner between the top bar and the content area, visible on every screen while a CRO Leader Admin/Advisor is inside an MSP's account. See §2.4.

### 2.2 Responsive Behavior

**Client-confirmed redesign:** the sidebar is now icon-only at every window width, not just narrower ones — labels are dropped in favor of a hover tooltip (Design System §8.9). This replaces the originally-spec'd width-based collapse/expand behavior. Per the PRD, GrowthOS Phase 1 is desktop-first with no other tablet-specific redesign.

### 2.3 Search

The top-bar search box searches **Contacts only** (name, company, email) and returns results in a dropdown or a Contacts-list results view. It does not search Opportunities, Lists, or Campaigns in Phase 1.

### 2.4 Role-Based Navigation

Sidebar items and in-page actions a role cannot use are shown **disabled** (visible, greyed out, not clickable) rather than hidden or redirecting — so every user can see the shape of the product even where they don't have access, and permissions are visually self-explanatory without documentation.
| **Role** | **Contacts** | **Opportunities** | **Lists** | **Campaigns** | **Reports** | **Settings** |
| --- | --- | --- | --- | --- | --- | --- |
| MSP Owner | Full | Full | Full | Full | Full | Full |
| MSP Admin | Full | Full | Full | Full | Full | Full |
| MSP Marketing User | Full | Full | Full | Full | View | Disabled |
| MSP Read-Only User | View | View | View | View | View | Disabled |

If a user reaches a disabled area anyway (a direct link, a bookmark), see the "Permission Denied" pattern in §6.

**Client-confirmed removal — MSP Sales User (2026-09-15):** this role is gone; see PRD §4 and Backend Schema §2 for the full rationale. MSP Marketing User absorbed its edit rights (Opportunities moved from View to Full) — its own Reports (View) and Settings (Disabled) restrictions are unchanged.

### 2.5 CRO Leader "Viewing As" Banner

When a CRO Leader Admin or Advisor enters an MSP's account from the CRO Leader dashboard (§4.10, §5.7), a banner appears above the content area on every screen for the duration of that session:
> **Viewing: [MSP Company Name]** — you are inside this account on behalf of the MSP. [Exit to My Dashboard]
The **Exit to My Dashboard** control lives inside the banner itself, always visible, so there's no need to hunt for it in a menu — one click returns the CRO Leader user to their own dashboard (§4.10) from anywhere in the MSP's account.

## 3. Complete Site Map

| **#** | **Section** | **Screen** | **Primary access** |
| --- | --- | --- | --- |
| A1 | Auth | Log In | Public |
| A2 | Auth | Forgot Password | Public |
| A3 | Auth | Reset Password (from emailed link) | Public (tokened link) |
| A4 | Auth | Accept Invite / Set Password (new user) | Public (tokened link) |
| B1 | Onboarding | Onboarding Profile Wizard | New MSP Owner, first login |
| C1 | Dashboard | Dashboard (Home) | All MSP roles |
| C2 | GOS Dashboard | GOS Dashboard (client-confirmed addition, 2026-09-16; backed by a real per-account schema per client-confirmed amendment, 2026-09-16 — Backend Schema §6.6c; readiness check, KPI band and hours cards added 2026-09-17 — §6.6d) — 14 GrowthOS Playbook steps as clickable hours cards, sits directly below Dashboard in the sidebar | All roles view; hours: MSP Owner/Admin + CRO Admin/Advisor edit; everything else: CRO Admin/Advisor edit |
| C3 | GOS Dashboard | Playbook Step Detail — an Hours panel for every step, then SEO/GEO get a tabbed Status Report / Suggestions & Fixes / Progress Tracker; the other 12 steps show Duties + KPIs only | All roles view; hours: MSP Owner/Admin + CRO Admin/Advisor edit; everything else: CRO Admin/Advisor edit |
| D1 | Contacts | Contacts List | All MSP roles |
| D2 | Contacts | Contact Detail (tabs: Overview, Activity, Opportunities, Emails) | All MSP roles |
| D3 | Contacts | Add Contact (manual) | Owner, Admin, Marketing |
| D4 | Contacts | Import Contacts (upload → map → validate → confirm) | Owner, Admin, Marketing |
| D5 | Companies | Companies List | All MSP roles |
| D6 | Companies | Company Detail (profile + linked Contacts + linked Opportunities) | All MSP roles |
| E1 | Opportunities | Opportunity Board (kanban by stage) | All MSP roles (edit: Owner/Admin/Marketing) |
| E2 | Opportunities | Opportunity List (sortable table) | All MSP roles |
| E3 | Opportunities | Opportunity Detail | All MSP roles (edit: Owner/Admin/Marketing) |
| F1 | Lists | Lists Index | All MSP roles |
| F2 | Lists | List Detail (members) | All MSP roles |
| F3 | Lists | Create List | Owner, Admin, Marketing |
| G1 | Campaigns | Campaigns Index | All MSP roles (view only for Read-Only) |
| G2 | Campaigns | Campaign Detail (stats) | All MSP roles |
| G3 | Campaigns | Compose Campaign (compose → select list → preview → send) | Owner, Admin, Marketing |
| H1 | Reports | Reports | All MSP roles |
| I1 | Settings | Users & Roles | Owner, Admin |
| I2 | Settings | Connected Email Accounts | Owner, Admin (each user connects their own) |
| I3 | Settings | Custom Statuses | Owner, Admin |
| I4 | Settings | My Profile | All MSP roles (own profile only) |
| I5 | Settings | Growth Solution Questionnaire (client-confirmed addition, 2026-09-15) | Owner, Admin edit; other MSP roles view; CRO Admin/Advisor and a granted partner get the same read+write parity they have elsewhere |
| I5b | Settings | GrowthOS Vision Board (client-confirmed addition, 2026-09-16) — nav label "GOS Vision Board" (amended 2026-09-16, matching I5's "GOS Questionnaire" shortening), page heading "GrowthOS Vision Board" | Owner, Admin edit; other MSP roles view; CRO Admin/Advisor and a granted partner get the same read+write parity they have elsewhere |
| J1 | CRO Leader | CRO Leader Dashboard (MSP search) — also serves as the Partner Dashboard (2026-09-08), account list scoped to grants for a partner | CRO Leader Admin, Advisor, Service Team; Partner (granted accounts only) |
| — | CRO Leader | _(inside any MSP account, all D–I screens render with the banner from §2.5)_ | CRO Leader Admin, Advisor, Service Team; Partner |
| K1 | System | Access Restricted (redirect target) | Any role hitting a disabled area |
| K2 | System | Not Found (404) | Any role, broken/stale link |
| K3 | System | Session Timeout (modal) | Any authenticated role |


## 4. Screen-by-Screen Specifications


### 4.1 Authentication & Account Setup

**Log In (A1).** Email + password fields, "Forgot password?" link, log in button. On success → Dashboard (or the Onboarding Wizard, if onboarding is incomplete — see §5.1). On failure, an inline error under the form ("Incorrect email or password") — the form does not clear.
**Forgot Password (A2).** Single email field. Always shows the same confirmation ("If that email exists, we've sent a reset link") whether or not the address is registered, so the flow can't be used to probe for valid accounts.
**Reset Password (A3).** Reached only via the emailed, tokened link. New password + confirm fields. An expired or already-used token shows an inline error with a link back to Forgot Password rather than a broken form.
**Accept Invite / Set Password (A4).** Reached via the emailed invite link (new MSP users, per §5.6). Shows the inviting company's name, the invitee's email (read-only), and a set-password form. On success → Dashboard directly (no onboarding wizard — that's an MSP Owner-only, account-level step, already completed by whoever set up the account).

### 4.2 Onboarding Profile Wizard (B1)

A multi-step wizard, shown to the MSP Owner on first login only, with a progress indicator and save-and-resume between steps (confirmed with the client). Steps, condensed from the PRD's onboarding profile to a Phase 1 basic pass:
- **Company Profile** — name, website, location, years in business, employee count
- **Sales & Marketing Snapshot** — current tools, CRM status, team size
- **Target Market** — target industries, geography, ideal company size
- **Growth Goals & Budget** — stated goals, budget range, timeline
- **Review & Finish** — summary of all entered data, edit-in-place, "Finish Setup" button
Leaving mid-wizard is always safe: progress saves after each step. Logging back in with onboarding incomplete returns the Owner to the first unfinished step, not the start. Completing step 5 → Dashboard, now in its empty state (§5.1).

### 4.3 Dashboard (C1)

The landing screen after login, in priority order:
- **Tasks/follow-ups due** — top of page, most actionable
- **Recent activity feed** — recent calls, emails, status changes across the account
- **Pipeline summary by opportunity stage** — a compact bar/count view (not the full board — that's Opportunities, §4.5)
- **Weekly/monthly KPI snapshot** — leads, opportunities created, meetings, campaign sends (a lighter version of §4.8 Reports)
Empty and loading states: see §6.

**Client-confirmed layout, "Concept B — Command Center" (approved mockup, 2026-09-08):** built as a KPI strip first (the convention most CRM home screens open with), then Pipeline by Stage and Recent Activity in a wide left column, with Tasks/Follow-ups Due pulled into a permanently visible highlighted rail on the right instead of this section's literal top-of-page slot — still the first thing the eye lands on, via placement/color rather than document order. "This week" is a trailing 7-day window, not a Sunday/Monday calendar week (neither document specifies one). Campaign Sends shows "—" until Campaigns (Milestone 10) exists, the same placeholder convention already used for Bounced on the Contacts table.

### 4.3a GOS Dashboard (C2–C3)

**Client-confirmed addition (2026-09-16).** A new top-level sidebar item, "GOS Dashboard," directly below Dashboard — sourced from "GrowthOS Playbook - Dev Plan.docx" rather than any of the six core spec documents, since the Playbook itself is new scope the client introduced in this session, not something PRD/App Flow/Implementation Plan had previously accounted for. **Client-confirmed amendment (2026-09-16):** no longer mockup-only — now backed by a real per-account schema (Backend Schema §6.6c), with the 14 step identities still living in app code (`lib/gos-dashboard/playbook.ts`) and only the per-account values in the database. **Client-confirmed (2026-09-17):** CRO Admin/Advisor edit every step's status, KPIs, and (SEO/GEO) status report/suggestions/tracker, and every other role — MSP and `cro_service_team` included — is read-only for those. The one exception is hours (below), which the account's own MSP Owner/Admin can also edit.

**GOS Dashboard (C2)** renders the Playbook's 14 numbered steps (SEO, GEO, Blogging & Content Development, Social Media, Website Oversight, ICP Development, List Building, Email Campaigning, CRM Administration, Opportunity Pipeline Metrics, Reviews & Testimonies, Events, SDR Outreach, Sales Enablement) as a flat grid of clickable cards — client-confirmed flat, not grouped by the Playbook's own 4 phases (Foundation & Visibility / Pipeline & Outbound Engine / Authority, Trust & Demand Creation / SDR Outreach & Sales Execution), though each card still shows its phase as a label. Cards originally showed a status pill and one headline stat; superseded by the 2026-09-17 redesign below.

**Client-confirmed redesign (2026-09-17), all sourced from the Playbook doc.** Top to bottom, the page now shows:

1. **Readiness check** — the doc's "Before You Begin — STOP": a website on file (Company settings) and a written ICP, counted as the Growth Solution Questionnaire's target-market answer. Both present: one slim "Ready to run the Playbook" line. Either missing: an amber "Before You Begin" warning with a link to fix it. It never blocks the rest of the page.
2. **GrowthOS KPI Dashboard band** — the doc's own KPI dashboard image: Prospects (MQCs, MQLs) and Opportunities in Pipeline (Interested, Engaged, Ghosted, Quoted, Won, Lost), counted live from the CRM (Backend Schema §6.6d). Each box names the status(es) or stage(s) it counts; clicking one opens its 10 most recent records, each linking to its detail page. CRO Admin/Advisor get "Edit mapping" to choose which statuses/stages feed each box — pre-filled by name matching until saved.
3. **Workstream hours totals** for the current calendar quarter across all 14 workstreams: needed, committed, achieved, number outsourced, and a quarter progress bar.
4. **The 14 cards** (still a flat grid), style "B — Ledger": short title ("SEO", "GEO", …) and status pill, then Needed · Committed · Achieved hours side by side (Achieved highlighted), Step 8's budget note from the doc, an achieved-vs-committed bar whose dark tick marks how far through the quarter we are (amber when well behind pace, green once past the commitment), and an **Outsourced** label that always reads "Outsourced" — green with a check when yes, red with an X when no. The phase label and headline stat no longer appear on the card; the headline stat stays on the detail page. MSP Owner/Admin and CRO Admin/Advisor see "Log hours" on each card; everyone else is view-only.

**Playbook Step Detail (C3).** Every step now opens with an **Hours** panel (client-confirmed 2026-09-17): needed, committed this quarter, achieved this quarter, still to go overall, the quarter bar, the Outsourced label, and "Log hours" for MSP Owner/Admin and CRO Admin/Advisor. The source doc only spells out a "GrowthOS Dashboard" sub-shape — status report, suggestions/fixes list, quarterly progress tracker — for step 1 (SEO) and step 2 (GEO); client-confirmed (2026-09-16) those two steps alone get that as three tabs, while the other 12 steps open straight to their Duties (as a plain list — deliberately not checkboxes, since these are ongoing recurring services, not one-time tasks to mark done) and KPIs (as a stat grid, each showing the doc's own target range). CRO Admin/Advisor can edit every field described above; every other role, MSP included, is read-only for those fields (Backend Schema §6.6c, client-confirmed 2026-09-17). Hours are the exception noted above.

**Client-confirmed rename (2026-09-15):** "Pipeline by Stage" is now labeled "Opportunities by Stage" on the actual Dashboard — a copy-only change, same component and data. Kept as "Pipeline by Stage" in the narrative above and elsewhere in this document where it describes the mockup as originally approved.

**Client-confirmed addition (2026-09-15):** a full-width banner sits above the KPI strip while the account's Growth Questionnaire (§4.9, I5) is incomplete — "Complete your Growth Solution Questionnaire," a short progress line, and its own progress bar.

**Client-confirmed addition (2026-09-16):** a second, independent banner ("Complete your GrowthOS Vision Board," I5b) sits directly beneath the Questionnaire one — stacks regardless of either's complete/incomplete state. The notification bell (Design System §8.10) gets the same treatment: a second dropdown item, independent dot condition, both can show at once.

**Client-confirmed amendment (2026-09-16):** both Dashboard banners now stay permanently visible instead of disappearing once complete — superseding the "disappears entirely" language above. Complete, each switches to a green state ("Growth Solution Questionnaire complete" / "GrowthOS Vision Board complete," "X of X answered," a check icon, "View →" instead of "Continue →") rather than vanishing; nothing else on the Dashboard shifts to fill the space either way. The notification bell dropdown is unaffected by this — it still drops its item and clears its dot once a document is complete, since a finished item genuinely needs no further action from a notification center.

### 4.4 Contacts (D1–D4)

Prospects and contacts are **one merged section** — every record is a person, optionally tied to a company; there's no separate "Prospects" area.
**Contacts List (D1).** **Client-confirmed redesign**, modeled on a reference CRM: a horizontally-scrolling table (no wrapping) with checkboxes, no per-row Actions *column*, and bulk mutations happening through the bulk action bar. Columns: Email, Full Name (derived from First/Last Name), Title, Contact Status, Score, Temp, Employees, Lists (which lists a contact belongs to — clickable, see below), Company, Company Phone, Mobile Phone, Person LinkedIn, Company Address, Company City, Company State, Subscribed, Bounced (a 0 placeholder until Campaigns/Milestone 10 exists). "Add Contact" and "Import Contacts" buttons top-right.

**Client-confirmed addition (2026-09-08):** double-clicking a row edits that one contact's own fields in place (Save/Cancel, no page navigation) — a per-row mutation path alongside, not a replacement for, the bulk action bar. The Lists cell is clickable: a popover lists every list the contact belongs to, each removable, with "Add to list" available there too.
**Bulk action bar** (appears once one or more rows are selected): Email (a stub — real sending needs Campaigns/Milestone 10, not built), Export (CSV, via the selection), Delete (soft-delete/archive with a confirmation prompt — contacts are never hard-deleted), and a More Actions menu with Assign (bulk salesperson reassignment — "Owner" renamed to "Salesperson" 2026-09-15, client-confirmed; the account role of the same original name is unaffected), Mark as (bulk status change), and Add to (add the selection to a list, any type). "Select all N items" selects every contact matching the current view, not just what's loaded — every bulk action operates on that full set. Merge was considered and dropped (client direction: a duplicate email updates the existing contact instead, so there's nothing separate to merge). Inside a specific list's Detail page, this same bar also gains Move to (moves the selection out of the current list into another) and Remove from this list — All Contacts has no single "current list," so only Add to applies there.
**Contact Detail (D2).** Tabbed layout:
- **Overview** — core fields (First Name, Last Name, title, email, Mobile Phone, Person LinkedIn, status, owner, Score, Temp, and the linked company's fields including Company Phone/Address), edit-in-place
- **Activity** — the full chronological timeline (calls, emails, meetings, tasks, notes) in its own tab, per the client's direction
- **Opportunities** — any opportunities tied to this contact, with a "Create Opportunity" action
- **Emails** — email history specifically (a filtered view of Activity, for quick scanning of just correspondence). **Client-confirmed addition (2026-09-08):** each entry expands to show the full From/To/Cc (From reflects whichever identity was actually displayed to the recipient — see the compose dialog below, not necessarily the logged-in sender) and the complete message body, not just a snippet.

**Client-confirmed addition (2026-09-08):** an "Email" button (opens a compose dialog: From, To fixed to this contact, Cc, Subject, Message) and, when a phone number is on file, a "Call" button (a plain `tel:` link — no telephony integration in Phase 1) sit above the stat row on Contact Detail's main content, next to Open Pipeline. Sending an email goes out through Resend (Tech Stack Lockfile §5.2, amended the same day from SendGrid) — the same relay Milestone 10's Campaigns will use — and automatically logs an Activity, no separate "log this" step. **Same-day follow-up:** From defaults to the sender's own identity, or can be set to any connected mailbox in the account (client-confirmed reversal of part of Backend Schema §6.3's single-user rule) — this only changes the display From/Reply-To, it does not send through that person's actual Gmail/Outlook. Cc is a plain comma/semicolon-separated address field, not required to match existing contacts.
**Add Contact (D3).** A manual-entry form covering the same fields as the list columns plus notes. **Client-confirmed change**: a matching email now updates the existing contact instead of blocking on a duplicate-email error (§6, "Duplicate Contact" — superseded for this specific create-vs-update case).
**Import Contacts (D4).** A four-step flow: **Upload** (CSV/XLSX) → **Map Columns** (match file columns to GrowthOS fields, with a best-guess auto-mapping to start) → **Validate** (shows row-level issues — missing required fields, invalid formats) → **Confirm** (summary: "X contacts ready to import" before committing). Per the client's direction, any validation failures **block the entire import** — see §5.3 and §6. A row's email matching an existing contact is no longer one of those failures (client-confirmed change, see above) — that row updates the existing contact instead.

**Client-confirmed redesign, Map Columns (2026-09-06, "Concept A — Spreadsheet-style column cards"):** the original screen listed GrowthOS fields and asked the user to pick one of their own column headers from a dropdown per field — a recall task if the user didn't remember their own file's header names. Flipped the direction instead: one card per column *from the file*, in its original order, each showing its raw header text, 2 real sample values pulled from the uploaded file, and a dropdown to say what GrowthOS field it becomes (or "Don't import"). Columns the auto-guesser matched confidently collapse into a single expandable "N columns auto-matched" summary bar (green, click to expand and double-check); everything else appears as a full card under a "need a quick look" heading. A status bar at the top always shows the two required fields (First Name, Email) as pass/fail pills, so a beginner never has to scroll to know if they're blocked from continuing. Explored as two initial concepts (a live raw-file-preview pane was the other, App Flow's own working notes) before landing on this one with the wrap-and-collapse refinement.

**Client-confirmed addition, Companies (D5–D6, 2026-09-08):** the Implementation Plan's Milestone 6 originally called for "companies list/detail screens," but this document never specced one and it was never built — the merge-companies flow lived inline on Contact Detail's Company card instead, since there was nowhere else for it to go. Reopening that gap rather than inventing new scope:
**Companies List (D5).** A table — Company Name, Website, Industry, Employees, City, State, Contacts (a live count) — with a search field above it, same shell as Lists Index. No "Add Company": companies are still created only through Add Contact/Import's company-matching flow, unchanged.
**Company Detail (D6).** The exact same field set as Contact Detail's Company card (Website, Company LinkedIn, Industry, Employees, Phone, Address, City, State), now with its own view/edit toggle, plus every Contact and Opportunity linked to this company. "Merge with another company" moved here from Contact Detail — Contact Detail's Company card now links out to Company Detail ("View Company") instead of offering merge itself. **Client-confirmed (2026-09-15):** its stat row's "Open Pipeline" tile is renamed **Prospect Value**, computed as `$200 × Employees × 12` rather than a real sum of the company's opportunities — see Design System §8.5.

**Client-confirmed redesign (2026-09-08):** a gradient hero (name, an uploadable company logo, industry/location) replaces the plain page title, with a stat row (Contacts, Open Pipeline, Opportunities) below it.

### 4.5 Opportunities (E1–E3)

**Opportunity Board (E1) — default view.** A kanban board grouped by stage (Identified Interest through Closed Won/Lost, Ghosted, On Hold, per the PRD's pipeline). Cards are draggable between stage columns; dragging a card updates its stage immediately. Given the number of stages, the board scrolls horizontally rather than compressing columns unreadably. Each card shows contact name, company, and value at a glance.
**Opportunity List (E2) — alternate view**, reached via a view toggle on the Board. A sortable/filterable table, for bulk review or when the full stage list is easier to scan as rows than as thirteen columns. This is an addition beyond the client's board-view answer, included because the PRD explicitly requires opportunities to be "sortable/filterable by stage" — flagged in §7 for confirmation.
**Opportunity Detail (E3).** Reached from a card or row. Core fields (stage, value, contact, company), notes, and its own activity timeline.

### 4.6 Lists (F1–F3)

**Lists Index (F1).** A table listing every list with name, contact count, date added, and (client-confirmed, modeled on a reference CRM) Bounced/Unsubscribed/Active columns — Bounced is a placeholder 0 until Campaigns (Milestone 10) exists to produce that data; Unsubscribed reads the real `contacts.email_opt_out` flag. "Upload List" and "Create List" buttons top-right; a per-row "Delete" (soft-delete via `archived_at`, not a real delete — lists aren't the one exception to that rule, Opportunities is), and (client-confirmed addition) Rename.
**List Detail (F2).** The list's member contacts as a table (reusing the Contacts List columns), plus add/remove actions: "Upload Contacts" (same CSV/XLSX pipeline as Import Contacts, except a row matching an existing contact's email is added to the list instead of blocking the whole file — client-confirmed, since a real list upload will usually overlap with existing contacts) and "Add Contacts" (search existing contacts). Bulk-select + **Move / Copy to List**: Move removes the selected contacts from the current list and adds them to the chosen destination; Copy adds them to the destination while leaving the current list's membership untouched (a contact can belong to multiple lists).
**Create List (F3).** Name only. **Client-confirmed removal (2026-09-06):** this screen originally offered a Static/Smart choice at creation — see below. Every list is now the plain, manually-curated kind; there is no other kind to choose.

**Superseded (2026-09-06) — Smart Lists removed entirely.** This section previously described two list types:
- Static list — manually add contacts, membership doesn't change on its own
- Smart list — built from saved filter criteria (e.g., industry + geography + status); membership updated automatically as contacts matched or stopped matching, with manual add/remove overrides layered on top

The client's direction: "My customers want to manually add contacts to a list" — not even Smart as an option. This is a deliberate deviation from PRD §6.3 ("Lists support manual add/remove **and** criteria-based (saved-filter) population") — flagged as a spec contradiction before removing it; the client confirmed removal anyway. See Backend Schema §5.4/§7.4 (`remove_smart_lists` migration) for the schema/function side of this removal.

### 4.7 Campaigns (G1–G3)

**Campaigns Index (G1).** Table of past and active campaigns: name, list sent to, send date, status (draft/sending/sent), and headline stats. "Create Campaign" button top-right.
**Campaign Detail (G2).** Recipient list, send status, and full stats: **sent, opened, clicked, bounced, and unsubscribed** — each with timestamps for opens and clicks, per the client's direction and the PRD's tracking requirement.
**Compose Campaign (G3).** A linear flow: **Compose** (subject, body, sender identity from the user's connected email account) → **Select List** (choose a list as the recipient set) → **Preview** (rendered preview + a test-send option) → **Send** (immediate or scheduled). If no email account is connected yet, this flow doesn't start — see §5.5 and §6.

### 4.8 Reports (H1)

One shared page for all roles (no role-specific dashboards, per the PRD). Sections mirror the Dashboard's KPI snapshot but in full: leads/contacts added, opportunities by stage, campaign performance (sent/opened/clicked/bounced/unsubscribed), revenue from closed-won opportunities. **Each section has its own "Export to Spreadsheet" button**, rather than one export for the whole page, per the client's direction.

**Client-confirmed layout, "Grid Dashboard" (approved mockup, 2026-09-08, chosen from five compared concepts):** all four sections sit in a compact 2×2 grid, visible at once with no scrolling on a normal desktop — leads as a weekly line chart, opportunities by stage as compact bars (the same visual language as the Dashboard's Pipeline by Stage), campaign performance as a table, and revenue from closed-won as monthly bars behind a total. No date-range picker (that was a different compared concept's own idea, not this one) — leads uses a trailing 8-week window and revenue a trailing 3-month window, fixed rather than user-adjustable in this pass.

### 4.9 Settings (I1–I5)

- **Users & Roles (I1)** — table of the MSP's users, their role, last login (§4.11 audit note), invite/remove actions, role-change dropdown
- **Connected Email Accounts (I2)** — each user's own Microsoft 365/Google Workspace connection status, with Connect/Reconnect actions. **Nav placement (client-confirmed 2026-09-08):** lives under the My Profile column as "Email Integration," not Account Settings — it's a per-user connection, not an account-wide one. The Account Settings column keeps a disabled "Email Auth" row as a placeholder for a not-yet-built, account-wide feature (registering the MSP's own sending domain with Resend from inside GrowthOS, instead of relying on the shared `EMAIL_FROM_ADDRESS` fallback) — backlogged, not scoped for Phase 1.
- **Custom Statuses (I3)** — manage the MSP's custom prospect statuses (add, rename, reorder, retire)
- **My Profile (I4)** — the logged-in user's own name, email, password change, and now the Email Integration row (above)
- **Growth Questionnaire (I5, client-confirmed addition 2026-09-15)** — Account Settings, right after Company. The 8-section, 75-question Growth Solution Questionnaire (source: "Growth Solution Questionnaire for MSPs.docx"), presented one section per screen ("Concept A — Stepped," approved from two compared mockups) with a dot-and-line progress stepper, Back / Save & Continue, and "Skip for now, remind me later" always available — nothing here is required to proceed. Each question's input matches what it's actually asking (a number field for a count, Yes/No for a yes/no question, a Hunters/Farmers choice, the one 1–4 scale question, free text for the rest), not a blanket text box. Answers save to `growth_questionnaire_responses` on every Continue/Skip/Finish. Once every question has an answer, "Export PDF" (§10, GET /api/questionnaire/export) becomes available in the wizard itself.
  - **Onboarding hook:** App Flow's own Onboarding Profile Wizard (B1, §4.2) was never actually built in this codebase despite being documented — `AcceptInviteForm` has always gone straight to the Dashboard. Rather than build the missing wizard to attach this to, a freshly-invited **Owner** (the one role this questionnaire is meant for) now lands on the Growth Solution Questionnaire first instead of the Dashboard after setting their password, with the same "Skip for now" escape hatch; every other invited role's flow is unchanged.
  - **Surfaced while incomplete, in two places, both client-confirmed:** a full-width Dashboard banner ("Complete your Growth Solution Questionnaire," its own progress bar, disappears entirely once done — §4.3) and the top bar's notification bell, which is otherwise fully decorative (Design System §8.10 — it was deliberately left with no fake unread state until a real notification existed). This is that first real notification: a red dot only while incomplete, one item linking to the questionnaire, an honest "You're all caught up" empty state once it's done.

### 4.10 CRO Leader Dashboard (J1)

Kept intentionally light, per the client's direction. One primary element: a **search-by-MSP box** at the top of the page, returning matching accounts as the CRO Leader Admin/Advisor types. Selecting an account enters it (§2.5, §5.7) — everything past that point is the same MSP screens described above, with the viewing-as banner.

**Client-confirmed addition (2026-09-08) — this screen doubles as the Partner Dashboard.** A new "partner" user (not in the original PRD role table — a vendor/agency relationship distinct from CRO Leader staff) reaches this exact same URL and layout, but the account list only shows accounts they've been explicitly granted, not every MSP on the platform; "New MSP Account" and the Partners management panel (invite a partner, grant/revoke which accounts they see) only render for CRO Admin. One screen, role-aware, rather than a second near-duplicate one — the two are structurally identical ("search and enter an account") once the RLS layer distinguishes who can see what.

### 4.11 System Screens

- **Access Restricted (K1)** — the redirect target when a role hits a disabled area directly (e.g., a Marketing User opening a Settings link). Lands on the Dashboard with an inline banner: "You don't have access to that page."
- **Not Found (K2)** — a standard 404-style page (e.g., a bookmarked contact that no longer exists), with a link back to Dashboard.
- **Session Timeout (K3)** — a blocking modal on session expiry: "Your session has ended — log in again to continue," with a log-in field inline so in-progress work elsewhere in the tab isn't lost more than necessary.

## 5. User Journeys


### 5.1 New MSP Account Setup

Account created (by CRO Leader) → Invite email to MSP Owner → Accept Invite/Set Password (A4) → Log In (A1) → Onboarding Profile Wizard (B1), steps 1–5 → Dashboard (C1), empty state
The MSP Owner is the only role that sees the wizard; any additional users they invite afterward (§5.6) go straight from Accept Invite to a populated Dashboard.

### 5.2 Connect an Email Account

Settings → Connected Email Accounts (I2) → "Connect" → Microsoft 365 or Google Workspace OAuth consent screen → redirected back to I2, status shows "Connected"
**On expiry:** the next attempted send fails; the user sees the blocking "reconnect" modal (§6) and is dropped back into the same OAuth consent flow. No separate "reconnect" screen — it's the same Connect action, run again.

### 5.3 Add Prospects — Manual and Import

**Manual:** Contacts List (D1) → "Add Contact" → Add Contact form (D3) → Save → back to D1, new row visible (or inline duplicate-email error, §6)
**Import:** Contacts List (D1) → "Import Contacts" → Upload file → Map Columns → Validate → (if any row fails) blocked, error summary shown, user fixes the file and re-uploads → Validate passes → Confirm → back to D1, all rows visible

### 5.4 Move a Prospect Through Statuses / Convert to an Opportunity

Contact Detail (D2), Overview tab → change Status field → saved inline — and separately — Contact Detail (D2), Opportunities tab → "Create Opportunity" → Opportunity Detail (E3), pre-filled with this contact → appears on Opportunity Board (E1) at Identified Interest

### 5.5 Build a List and Send a Campaign

Lists Index (F1) → "Create List" → Create List (F3), name it → Save → List Detail (F2)
then
Campaigns Index (G1) → "Create Campaign" → Compose (G3) → Select List (the one just built) → Preview → Send → Campaign Detail (G2), stats begin populating as recipients open/click
If no email account is connected, Compose Campaign doesn't open — the user is directed to Settings → Connected Email Accounts (§4.7, §6) first.

### 5.6 Invite/Remove a User, Change a Role

Settings → Users & Roles (I1) → "Invite User" → enter email + role → invite sent (recipient continues at §5.1's Accept Invite step, skipping onboarding)
Settings → Users & Roles (I1) → select existing user → change role dropdown → confirm · — or — → "Remove" → confirmation modal (§6) → user access revoked

### 5.7 CRO Leader: Find and Enter an MSP Account, Then Exit

CRO Leader Dashboard (J1) → search box → select MSP → enters that MSP's Dashboard (C1), viewing-as banner visible (§2.5) → navigates any D–I screen exactly as the MSP would see it → "Exit to My Dashboard" in the banner → back to J1

### 5.8 Login, Logout, Password Reset, Session Timeout

Log In (A1) → Dashboard (C1) · User menu → "Log Out" → A1 · A1 → "Forgot password?" → Forgot Password (A2) → email sent → Reset Password (A3), from link → A1 · mid-session, token expires → Session Timeout modal (K3) → re-authenticate inline → resume where left off

## 6. Global UI Patterns

Rather than repeating these on every screen in §4, they're defined once here and apply everywhere they're relevant.
| **Pattern** | **Behavior** |
| --- | --- |
| Empty state (any list: Contacts, Opportunities, Lists, Campaigns) | Plain "No records yet" message — no onboarding prompts or sample data |
| Empty state — Dashboard, brand-new account | "No activity yet" — same plain treatment |
| Empty state — Campaigns, no email account connected | Message directs the user to connect an email account first, before anything about creating a campaign |
| Loading state | Spinner (not skeleton screens) |
| Import validation failure | Blocks the entire import; error summary lists every failing row and reason before anything is committed |
| Duplicate contact (manual entry or import) | Blocked on exact email-address match; inline error naming the existing record |
| Email account disconnected/token expired | Blocking modal, not a passive banner — stops the user before a send fails silently |
| Campaign send with partial failures | Aggregate count shown: "X of Y sent" (not a per-recipient breakdown) |
| Permission-denied direct access | Redirect to Dashboard with an inline "you don't have access" banner (§4.11, K1) |
| Broken/stale link | Standard 404 page (§4.11, K2) |
| General network/loading failure | Silent toast — no blocking retry dialog |
| Destructive or state-changing action (remove user, archive a list) | Confirmation modal before it takes effect |
| Success/failure feedback | Toast notifications for quick confirmations, inline banners for anything the user needs to keep seeing (e.g., a form-level error) — both are used, matched to context |


## 7. Open Items & Assumptions

Flagged for confirmation before or during build, rather than blocking this document:
- **Opportunity List/table view (E2)** is my addition alongside the confirmed kanban board, to satisfy the PRD's "sortable/filterable by stage" requirement — confirm this second view is wanted, or that the board's grouping alone is considered sufficient.
- **List builder (F3)** — resolved 2026-09-06: the static/smart split proposed here was built, then removed entirely per client direction (§4.6) in favor of a single, always-manual list type.
- **Onboarding wizard steps (§4.2)** are condensed from the PRD's full onboarding-profile field list into five steps for a Phase 1 "basic version, single pass" — confirm the grouping, or whether any fields should move to a later phase.
- **Exit-to-dashboard placement (§2.5)** — placed inside the viewing-as banner itself; flag if a top-bar location is preferred instead.
- This document assumes the same left-sidebar/top-bar shell for CRO Leader users as for MSP users (with the added banner) rather than a visually distinct admin shell — confirm that reads as "light" enough for Phase 1, or if the CRO Leader dashboard should look more clearly separate.
