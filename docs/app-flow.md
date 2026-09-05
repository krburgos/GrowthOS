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
| MSP Sales User | Full | Full | View | View | View | Disabled |
| MSP Marketing User | Full | View | Full | Full | View | Disabled |
| MSP Read-Only User | View | View | View | View | View | Disabled |

If a user reaches a disabled area anyway (a direct link, a bookmark), see the "Permission Denied" pattern in §6.

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
| D1 | Contacts | Contacts List | All MSP roles |
| D2 | Contacts | Contact Detail (tabs: Overview, Activity, Opportunities, Emails) | All MSP roles |
| D3 | Contacts | Add Contact (manual) | Owner, Admin, Sales, Marketing |
| D4 | Contacts | Import Contacts (upload → map → validate → confirm) | Owner, Admin, Sales, Marketing |
| E1 | Opportunities | Opportunity Board (kanban by stage) | All MSP roles (edit: Owner/Admin/Sales) |
| E2 | Opportunities | Opportunity List (sortable table) | All MSP roles |
| E3 | Opportunities | Opportunity Detail | All MSP roles (edit: Owner/Admin/Sales) |
| F1 | Lists | Lists Index | All MSP roles |
| F2 | Lists | List Detail (members) | All MSP roles |
| F3 | Lists | Create/Edit List (static or smart) | Owner, Admin, Marketing |
| G1 | Campaigns | Campaigns Index | All MSP roles (view only for Read-Only/Sales) |
| G2 | Campaigns | Campaign Detail (stats) | All MSP roles |
| G3 | Campaigns | Compose Campaign (compose → select list → preview → send) | Owner, Admin, Marketing |
| H1 | Reports | Reports | All MSP roles |
| I1 | Settings | Users & Roles | Owner, Admin |
| I2 | Settings | Connected Email Accounts | Owner, Admin (each user connects their own) |
| I3 | Settings | Custom Statuses | Owner, Admin |
| I4 | Settings | My Profile | All MSP roles (own profile only) |
| J1 | CRO Leader | CRO Leader Dashboard (MSP search) | CRO Leader Admin, Advisor |
| — | CRO Leader | _(inside any MSP account, all D–I screens render with the banner from §2.5)_ | CRO Leader Admin, Advisor |
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

### 4.4 Contacts (D1–D4)

Prospects and contacts are **one merged section** — every record is a person, optionally tied to a company; there's no separate "Prospects" area.
**Contacts List (D1).** Table view. Default columns, every one sortable ascending/descending: Name, Company, Status, Owner/Salesperson, Employee Size, Last Activity Date, Company City, Company State. Filters available on the same fields (plus List membership). Row click → Contact Detail. "Add Contact" and "Import Contacts" buttons top-right.
**Contact Detail (D2).** Tabbed layout:
- **Overview** — core fields (contact info, company info, status, owner), edit-in-place
- **Activity** — the full chronological timeline (calls, emails, meetings, tasks, notes) in its own tab, per the client's direction
- **Opportunities** — any opportunities tied to this contact, with a "Create Opportunity" action
- **Emails** — email history specifically (a filtered view of Activity, for quick scanning of just correspondence)
**Add Contact (D3).** A manual-entry form covering the same fields as the list columns plus notes. Duplicate-email check runs on save (§6, "Duplicate Contact").
**Import Contacts (D4).** A four-step flow: **Upload** (CSV/XLSX) → **Map Columns** (match file columns to GrowthOS fields, with a best-guess auto-mapping to start) → **Validate** (shows row-level issues — missing required fields, duplicate emails against existing contacts) → **Confirm** (summary: "X contacts ready to import" before committing). Per the client's direction, any validation failures **block the entire import** — see §5.3 and §6.

### 4.5 Opportunities (E1–E3)

**Opportunity Board (E1) — default view.** A kanban board grouped by stage (Identified Interest through Closed Won/Lost, Ghosted, On Hold, per the PRD's pipeline). Cards are draggable between stage columns; dragging a card updates its stage immediately. Given the number of stages, the board scrolls horizontally rather than compressing columns unreadably. Each card shows contact name, company, and value at a glance.
**Opportunity List (E2) — alternate view**, reached via a view toggle on the Board. A sortable/filterable table, for bulk review or when the full stage list is easier to scan as rows than as thirteen columns. This is an addition beyond the client's board-view answer, included because the PRD explicitly requires opportunities to be "sortable/filterable by stage" — flagged in §7 for confirmation.
**Opportunity Detail (E3).** Reached from a card or row. Core fields (stage, value, contact, company), notes, and its own activity timeline.

### 4.6 Lists (F1–F3)

**Lists Index (F1).** A clean card or table listing every list with name, member count, and type (static/smart). "Create List" button top-right.
**List Detail (F2).** The list's member contacts as a table (reusing the Contacts List columns), plus add/remove actions.
**Create/Edit List (F3).** Two modes, chosen at creation — left as a design decision per the client's "make it clean" direction:
- **Static list** — manually add contacts, membership doesn't change on its own
- **Smart list** — built from saved filter criteria (e.g., industry + geography + status); membership updates automatically as contacts match or stop matching

### 4.7 Campaigns (G1–G3)

**Campaigns Index (G1).** Table of past and active campaigns: name, list sent to, send date, status (draft/sending/sent), and headline stats. "Create Campaign" button top-right.
**Campaign Detail (G2).** Recipient list, send status, and full stats: **sent, opened, clicked, bounced, and unsubscribed** — each with timestamps for opens and clicks, per the client's direction and the PRD's tracking requirement.
**Compose Campaign (G3).** A linear flow: **Compose** (subject, body, sender identity from the user's connected email account) → **Select List** (choose a static or smart list as the recipient set) → **Preview** (rendered preview + a test-send option) → **Send** (immediate or scheduled). If no email account is connected yet, this flow doesn't start — see §5.5 and §6.

### 4.8 Reports (H1)

One shared page for all roles (no role-specific dashboards, per the PRD). Sections mirror the Dashboard's KPI snapshot but in full: leads/contacts added, opportunities by stage, campaign performance (sent/opened/clicked/bounced/unsubscribed), revenue from closed-won opportunities. **Each section has its own "Export to Spreadsheet" button**, rather than one export for the whole page, per the client's direction.

### 4.9 Settings (I1–I4)

- **Users & Roles (I1)** — table of the MSP's users, their role, last login (§4.11 audit note), invite/remove actions, role-change dropdown
- **Connected Email Accounts (I2)** — each user's own Microsoft 365/Google Workspace connection status, with Connect/Reconnect actions
- **Custom Statuses (I3)** — manage the MSP's custom prospect statuses (add, rename, reorder, retire)
- **My Profile (I4)** — the logged-in user's own name, email, password change

### 4.10 CRO Leader Dashboard (J1)

Kept intentionally light, per the client's direction. One primary element: a **search-by-MSP box** at the top of the page, returning matching accounts as the CRO Leader Admin/Advisor types. Selecting an account enters it (§2.5, §5.7) — everything past that point is the same MSP screens described above, with the viewing-as banner.

### 4.11 System Screens

- **Access Restricted (K1)** — the redirect target when a role hits a disabled area directly (e.g., a Sales User opening a Settings link). Lands on the Dashboard with an inline banner: "You don't have access to that page."
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

Lists Index (F1) → "Create List" → Create/Edit List (F3), choose Static or Smart → Save → List Detail (F2)
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
- **List builder (F3)** — the static/smart split is my proposed shape for "make it clean"; happy to revise once there's a visual design pass.
- **Onboarding wizard steps (§4.2)** are condensed from the PRD's full onboarding-profile field list into five steps for a Phase 1 "basic version, single pass" — confirm the grouping, or whether any fields should move to a later phase.
- **Exit-to-dashboard placement (§2.5)** — placed inside the viewing-as banner itself; flag if a top-bar location is preferred instead.
- This document assumes the same left-sidebar/top-bar shell for CRO Leader users as for MSP users (with the added banner) rather than a visually distinct admin shell — confirm that reads as "light" enough for Phase 1, or if the CRO Leader dashboard should look more clearly separate.
