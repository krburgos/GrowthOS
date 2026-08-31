GrowthOS Implementation Plan
**Purpose:** the sequenced, step-by-step build plan Claude Code follows to take GrowthOS Phase 1 from an empty repository to a live production deployment. This is the sixth and final document in the build-input series (Product Requirements Document → App Flow Document → Tech Stack Lockfile → Design System → Backend Schema Document → this plan) and assumes all five are available as reference material throughout the build — this document sequences the work; it doesn't restate the specification.
**Scope note:** "Phase 1" here means the CRM Foundation scope locked across the five prior documents — it is not the same numbering as the Developer Brief's six-phase MVP sequence (M365 Integration, Onboarding/Website Assessment, AI Engine, etc.), all of which remain out of scope for this plan.

## 1. How to Use This Document

This plan is organized as **thirteen milestones**, each a self-contained chunk of work ending in a checkpoint. The intended working pattern:
- Claude Code completes one milestone fully — every step in that milestone's list — before starting the next.
- At the end of a milestone, Claude Code stops, reports what was built, and runs through that milestone's checkpoint list itself where it can (e.g., confirming a page renders, a query returns expected rows).
- Anything in the checkpoint list that requires a human judgment call (visual QA, a real email inbox, a live OAuth consent screen) is called out as **Human verification** — Claude Code should wait for explicit confirmation on those items before moving on, rather than assuming success.
- Milestones are ordered by dependency, not by size — some are a few hours of work, others considerably more. Don't compress milestones to save round-trips; the checkpoints are there because each one is a real point where a wrong assumption gets expensive to unwind later (wrong RLS policy under real data, wrong OAuth scope after the consent screen is live, etc.).
No automated test suite is part of this plan — the Tech Stack Lockfile's dev tooling is deliberately minimal (ESLint only), confirmed with the client. §17 is a manual QA checklist instead, run once near the end rather than continuously; each milestone's own checkpoint is the closest thing to per-feature testing along the way.

## 2. Prerequisites & Human-Only Setup

Claude Code cannot create third-party accounts, register OAuth applications, or edit DNS — these need a person with access to the client's Google/Microsoft/GitHub/Vercel/Supabase/SendGrid accounts and the sending domain. The table below is everything that needs a human, in the order it's actually needed (not all of it is needed on day one).
| **#** | **Item** | **Needed before** | **Who / what's required** |
| --- | --- | --- | --- |
| 1 | Empty GitHub repository, with push access for the environment Claude Code runs in | Milestone 1 | Client or dev lead creates the repo and grants access (or provides a personal access token) |
| 2 | Vercel account, project linked to that repository | Milestone 1 | Client or dev lead — Vercel's GitHub integration auto-deploys every push as a preview URL from the first commit onward, which is what makes the milestone checkpoints reviewable without waiting for a custom domain |
| 3 | Supabase account, new project created | Milestone 2 | Client or dev lead — provides NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY once created |
| 4 | pg_cron and pg_net extensions enabled | Milestone 2 | Client or dev lead, from the Supabase dashboard (Database → Extensions) — these can be blocked on lower project tiers, so confirm before Milestone 2 rather than discovering it mid-migration |
| 5 | Google Cloud Console OAuth client (Workspace) | Milestone 9 | Client — OAuth consent screen configured, redirect URI https://<vercel-preview-or-production-domain>/api/oauth/google/callback registered, minimal scope (email + profile only — see §10) |
| 6 | Microsoft Entra ID app registration | Milestone 9 | Client — redirect URI https://<domain>/api/oauth/microsoft/callback, same minimal scope |
| 7 | SendGrid account, sending domain authenticated (SPF/DKIM/DMARC records on the client's DNS) | Milestone 10 | Client — DNS access on the domain campaigns will send from |
| 8 | SendGrid Event Webhook pointed at /api/webhooks/sendgrid | Milestone 10 | Client, from the SendGrid dashboard — can point at the Vercel preview URL for early testing, then be updated to the production domain at go-live |
| 9 | Production custom domain, DNS pointed at Vercel | Milestone 13 | Client |

Two secrets are generated, not issued by a vendor — Claude Code can generate both (e.g. openssl rand -base64 32), but a human must be the one to paste them into Vercel's environment variable settings rather than committing them anywhere:
- TOKEN_ENCRYPTION_KEY — needed by Milestone 9
- CRON_SECRET — needed by Milestone 10, and must also be set via ALTER DATABASE ... SET app.settings.cron_secret in Supabase (Backend Schema Document §8) to the same value

## 3. Build Sequence Overview

| **#** | **Milestone** | **Depends on** | **Checkpoint focus** |
| --- | --- | --- | --- |
| 1 | Repository, Scaffold & Design System Foundation | Prereqs #1–2 | App boots, design tokens render correctly |
| 2 | Supabase Project & Database Migration | Prereqs #3–4 | Schema, RLS, functions all present and match the Backend Schema Document |
| 3 | Environment Wiring, Supabase Clients & Auth Middleware | Milestone 2 | Session persists across a reload; RLS actually blocks a cross-account query |
| 4 | Authentication & User Management | Milestone 3 | Invite → set password → login works for every role |
| 5 | Global App Shell & Navigation | Milestone 4 | Nav matches the Backend Schema §2 permission matrix per role |
| 6 | Companies, Contact Statuses & Contacts (Core CRM) | Milestone 5 | Import a real CSV; dedup and domain-match both fire correctly |
| 7 | Lists & Segmentation | Milestone 6 | A smart list's live membership matches its criteria |
| 8 | Opportunities & Activity Timeline | Milestone 6 | Dragging a card across the board persists the new stage |
| 9 | Email Connections (OAuth) | Milestones 4, 7–8 | A real Google and a real Microsoft mailbox both connect successfully |
| 10 | Campaigns, Scheduled Sending & Tracking | Milestones 7, 9 | A real test campaign sends, and open/click/bounce/unsubscribe all record |
| 11 | Dashboard, Reporting & CRO Leader Admin View | Milestones 6, 8, 10 | Dashboard numbers match a manual count against the database |
| 12 | QA Pass, Accessibility & Polish | All above | Manual QA checklist (§17) fully signed off |
| 13 | Production Deployment & Handoff | Milestone 12, Prereq #9 | Production smoke test passes end to end |


## 4. Milestone 1 — Repository, Scaffold & Design System Foundation

**Goal:** an empty app that boots, styled with the exact Design System tokens, with every dependency pinned to the Tech Stack Lockfile's versions.
- Clone the empty repository (Prereq #1). Scaffold with create-next-app using the exact next/react/typescript versions from the Tech Stack Lockfile §3.1 (App Router, TypeScript, no src/ directory vs. src/ — Claude Code's own default is fine, just be consistent for the rest of the build).
- Replace the generated package.json dependencies with the Tech Stack Lockfile §4 fragment verbatim. Install with exact versions (npm ci after pinning, not npm install, so nothing resolves to a caret-range newer version).
- Configure ESLint per Tech Stack Lockfile §3.9.
- Install Tailwind CSS v4 and set up the @theme token block from the Design System §9 exactly as written — colors, type scale, spacing, radii, shadows. This is the single source of truth every component below draws from; do not hand-roll one-off values later.
- Run the shadcn/ui CLI init (Design System §5.4 of the Tech Stack Lockfile: it's a methodology, not a dependency) and scaffold the base primitives the Design System's component specs reference (Button, Input, Select, Dialog, Tabs, Toast, Badge, Table, Tooltip). Restyle each to match the Design System's §8 component specs at the token level (radius, spacing, color mapping) — this is the one place in the build where matching the spec precisely up front saves rework in every later milestone.
- Set up the directory structure: app/(auth)/, app/(app)/ for the authenticated shell, app/api/ for API routes, lib/supabase/ for client helpers, components/ui/ (shadcn primitives), components/ (app-specific components).
- Add .env.example listing every variable from the Tech Stack Lockfile §7 and the Backend Schema Document §12 item 8, with placeholder values — this becomes the running checklist for every environment variable introduced in later milestones.
- .gitignore, initial commit, push. Confirm the Vercel integration produces a working preview deployment of the (still essentially blank) app.
**Checkpoint:**
- Claude Code: npm run build succeeds with zero TypeScript errors; the dev server boots; a placeholder page renders using at least one restyled shadcn component to confirm the theme tokens are wired correctly (e.g., a Button in the primary brand color, correct radius).
- Human verification: open the Vercel preview URL and visually confirm the button/color/type match the Design System — this is the cheapest point in the whole build to catch a token mis-mapping, before dozens of screens are built on top of it.

## 5. Milestone 2 — Supabase Project & Database Migration

**Goal:** the complete schema, RLS policies, and functions from the Backend Schema Document running against a real Supabase project, with nothing improvised.
- Confirm Prereqs #3–4 are done (project created, pg_cron/pg_net enabled). Install the Supabase CLI locally for migration management.
- Write the migration files in this exact order, each as its own migration so a failure is easy to isolate and re-run: extensions & enums (Backend Schema §5.1) → accounts/users/email_connections (§5.2) → companies/contact_statuses/contacts (§5.3) → lists/list_members (§5.4) → opportunities/activities (§5.5) → campaigns/campaign_recipients/campaign_events (§5.6) → RLS helper functions and policies in full (§6, all subsections) → database functions and triggers in full (§7, all subsections).
- Copy every SQL block from the Backend Schema Document verbatim — this document is the specification, not a starting point to improvise from. If a statement fails, fix the migration to match the spec rather than diverging from it; if the spec itself looks wrong, stop and flag it rather than silently patching around it.
- Run the one-time ALTER DATABASE setup and cron.schedule call from Backend Schema Document §8, using a placeholder app_url for now (the Vercel preview URL) — this gets updated to the production domain in Milestone 13.
- In the Supabase dashboard, confirm Auth is configured for email/password only (no public signup — Auth settings should disable self-serve sign-ups, since every user in this system arrives via inviteUserByEmail, per Backend Schema Document §3).
**Checkpoint:**
- Claude Code: run the migrations against the project; query information_schema.tables and pg_policies to confirm all 13 tables exist with RLS enabled and confirm pg_cron's cron.job table has the send-due-campaigns entry registered.
- Human verification: none required for this milestone — it's entirely inspectable via SQL, and there's no UI yet to eyeball. Claude Code should paste the verification query results into its milestone report rather than asserting success.

## 6. Milestone 3 — Environment Wiring, Supabase Clients & Auth Middleware

**Goal:** the app can talk to Supabase, and RLS is provably doing its job before any real feature is built on top of it.
- Set the three Supabase environment variables (Prereq #3) in both .env.local and the Vercel project settings.
- Install and configure @supabase/ssr (Tech Stack Lockfile §3.3): a browser client, a server client (for Server Components/Route Handlers), and Next.js middleware that refreshes the auth session cookie on every request.
- Create a Supabase admin client wrapper (using SUPABASE_SERVICE_ROLE_KEY) for use only inside app/api/ routes — never imported into anything that could run client-side.
- Write a throwaway internal test route (deleted before Milestone 13) that runs one query as an anonymous/unauthenticated client and confirms it returns zero rows from contacts — proving RLS is actually blocking access before real UI is built that could mask a misconfigured policy.
**Checkpoint:**
- Claude Code: the throwaway RLS-proof route returns the expected empty result; a manually-inserted test row (via the Supabase SQL editor, service role) is invisible to the anon client and visible to the service-role client.
- Human verification: none required — this is a backend-only milestone.

## 7. Milestone 4 — Authentication & User Management

**Goal:** every one of the eight roles can be invited, can log in, and lands in the right place, per the App Flow Document's auth screens and the Backend Schema Document's user lifecycle (§3).
- Build the login screen and the set-password/accept-invite screen (App Flow Document's global auth flow).
- Build POST /api/users/invite (Backend Schema §10) and POST /api/users/[id]/deactivate (including the Auth Admin API session-revocation call called out in Backend Schema §3 — don't skip this half of deactivation).
- Build the user management screen (list, invite, deactivate, change role) — visible per the Backend Schema §2 permission matrix (Owner/Admin for their own account, CRO Admin for any account).
- Build the profile/settings screen (self-service name/avatar edit; role and account are read-only here, enforced by both the UI and the prevent_self_role_escalation trigger).
- Wire role-based landing: MSP roles land in the MSP portal shell, CRO Leader roles land in the CRO Leader admin dashboard shell (App Flow Document §4, Backend Schema §6.8/PRD §6.8).
**Checkpoint:**
- Claude Code: seed one test account and one user per role (8 total) via direct SQL insert plus the invite flow, confirm each can log in.
- Human verification: actually receive and click one real invite email end to end (Supabase's default email delivery is fine for this — SendGrid isn't wired up until Milestone 10), to confirm the invite → set password → login path works outside of a seeded/simulated session.

## 8. Milestone 5 — Global App Shell & Navigation

**Goal:** the sidebar, top bar, and CRO Leader banner from the Design System (§8.9, §8.10), wired to the real site map from the App Flow Document (§3) with role-based visibility from the Backend Schema Document §2.
- Build the sidebar navigation with every Phase 1 section from the App Flow Document's Complete Site Map, showing/hiding entries per the current user's role.
- Build the top bar, including the CRO Leader banner that appears only for CRO Leader roles (App Flow Document / Design System §8.10).
- Build the shared empty-state, loading-state, and error-state components from Design System §8.11 — every list/table screen in Milestones 6–11 reuses these rather than improvising its own.
- Wire the account-switcher affordance for CRO Leader roles if the App Flow Document specifies one at the shell level (cross-check App Flow Document before building — if it's scoped to individual screens instead, build it there in Milestone 11 and skip it here).
**Checkpoint:**
- Claude Code: log in as each of the 8 seeded test users (Milestone 4) and confirm the nav items shown match the Backend Schema §2 permission matrix exactly — this is the cheapest point to catch a permission-matrix mismatch, before 6 milestones of feature screens get built inside the wrong nav.
- Human verification: none required — this is directly checkable against the matrix table.

## 9. Milestone 6 — Companies, Contact Statuses & Contacts (Core CRM)

**Goal:** the heart of the CRM — prospect/contact data entry, import, and the status pipeline — matching PRD §6.1–6.2 and App Flow Document's Contacts screens.
- Build the contact statuses management screen (Owner/Admin/CRO Admin/CRO Advisor only) — list, reorder, rename, add custom, archive. Seed verification: confirm the 14 defaults from Backend Schema §7.5 appear automatically for the test account created in Milestone 4.
- Build the companies list/detail screens, including the merge-companies flow (Backend Schema §7.3's merge_companies function) as a deliberate user action, not automatic.
- Build the contacts list (sortable/filterable table, per PRD §6.1) and detail screen, with the unified activity timeline placeholder (populated fully in Milestone 8).
- Build the contact create/edit form (react-hook-form + zod, Tech Stack Lockfile §3.4) calling match_or_create_company() (Backend Schema §7.3) when a domain is supplied.
- Build POST /api/import/validate and POST /api/import/commit (Backend Schema §10): CSV via papaparse, XLSX via ExcelJS, column mapping UI, a preview/error report before commit, then a real insert respecting the dedup index and auto-company-match.
- Surface the dedup rule in the UI: a manual-entry attempt with a duplicate account+email should fail with a clear message, not a raw constraint-violation error.
**Checkpoint:**
- Claude Code: import a small test CSV (5–10 rows, including one intentional duplicate email and one row sharing a domain with an existing company) and confirm the dedup and auto-match both behave as specified.
- Human verification: log in as an msp_read_only test user and confirm every edit control is disabled/hidden, and as msp_sales and confirm edit works — spot-checking the RLS write-role matrix (Backend Schema §6.4) against real UI, not just the policy SQL.

## 10. Milestone 7 — Lists & Segmentation

**Goal:** static and smart lists, per PRD §6.3 and the criteria schema defined in Backend Schema §7.4.
- Build the lists screen: create/rename/archive, static vs. smart toggle.
- Build static list management: add/remove contacts individually and via bulk-select from the contacts table (Milestone 6).
- Build the smart list criteria builder UI, restricted to exactly the seven whitelisted fields and five operators from Backend Schema §7.4 — this UI should make it structurally impossible to submit anything compute_smart_list_members() would reject, rather than relying on the function's own error handling as the only guardrail.
- Wire smart list detail views to call compute_smart_list_members() live rather than caching results anywhere.
**Checkpoint:**
- Claude Code: build one static list (5 contacts) and one smart list (e.g., "status = Prospect") against the Milestone 6 test data, and confirm the smart list's membership updates live when a matching contact's status changes.
- Human verification: none required — directly checkable.

## 11. Milestone 8 — Opportunities & Activity Timeline

**Goal:** the Opportunity Kanban board and the unified activity timeline, per App Flow Document §4.5 and PRD §6.4–6.5.
- Build the Opportunity Board (dnd-kit, Tech Stack Lockfile §3.5) with all 13 stage columns (Backend Schema §5.1), horizontal scroll rather than column compression (App Flow Document §4.5), drag-to-change-stage persisting immediately.
- Build the Opportunity List view (sortable/filterable table) as the alternate view toggle.
- Build the Opportunity Detail screen (stage, value, contact, company, notes, its own activity timeline).
- Build the shared activity timeline component (calls/emails/meetings/tasks/notes, PRD §6.5) and wire it into both the Contact Detail screen (Milestone 6) and Opportunity Detail screen — one component, two mount points, per the "unified" requirement.
- Build task-specific activity behavior: due date, completion toggle, and (if the App Flow Document specifies it) a surfaced "what's due" view on the dashboard — cross-check before building; if the App Flow Document doesn't call for it, leave it for Milestone 11's dashboard work instead of guessing at scope here.
**Checkpoint:**
- Claude Code: create an opportunity from a Milestone 6 test contact, drag it across three stage columns, confirm each move persists on reload; log a call, an email, and a task against it and confirm all three appear in both the opportunity's and the underlying contact's timeline.
- Human verification: visual check of the board against Design System §8.4 (Opportunity Kanban Board spec) — card layout, spacing, and the "cards stay neutral, only [stage indicator] carries color" rule are easiest to verify by eye.

## 12. Milestone 9 — Email Connections (OAuth)

**Goal:** a user can connect a Google Workspace or Microsoft 365 mailbox, with tokens encrypted at rest, per Backend Schema §5.2 and §7.
- Confirm Prereqs #5–6 (OAuth apps registered, redirect URIs set to match the current deployment URL) and generate TOKEN_ENCRYPTION_KEY (§2 above), added to Vercel by a human.
- Implement AES-256-GCM encryption/decryption helpers (Node.js crypto) — this is application code, not a database concern; Postgres only ever stores the encrypted text (Backend Schema §5.2).
- Build GET /api/oauth/[provider]/start and GET /api/oauth/[provider]/callback (Backend Schema §10). Request the minimal scope only — email address and basic profile (e.g., Google's userinfo.email, Microsoft's User.Read) — since actual sending goes through the SendGrid relay in Milestone 10, not through the provider's own send API; this connection exists to verify and display a legitimate from-address, not to grant mail-send permission.
- Build the connection management UI (connect, view status, disconnect) — strictly scoped to the logged-in user's own connection, with no CRO Leader override anywhere in the UI (matching the RLS policy's own lack of one, Backend Schema §6.3).
**Checkpoint:**
- Human verification required for this entire milestone — OAuth cannot be meaningfully verified without a live consent screen. Connect one real Google Workspace mailbox and one real Microsoft 365 mailbox (a test/sandbox account is fine) end to end; confirm both show as connected in the UI, and confirm directly in the database (via the Supabase SQL editor) that the stored token values are encrypted ciphertext, not plaintext.

## 13. Milestone 10 — Campaigns, Scheduled Sending & Tracking

**Goal:** the full send pipeline — compose, schedule, send via SendGrid, and record opens/clicks/bounces/unsubscribes — exactly as sequenced in Backend Schema §8–§9.
- Confirm Prereqs #7–8 (SendGrid account, domain authentication, webhook pointed at the current deployment) and set CRON_SECRET in both Vercel and the Supabase database (ALTER DATABASE ... SET app.settings.cron_secret, Backend Schema §8) — the two must match exactly.
- Configure Nodemailer with the SendGrid SMTP relay (Tech Stack Lockfile §3.8/§5.2).
- Build the campaign composer — plain-text/basic formatting only, no rich-text editor (Tech Stack Lockfile §5.3) — targeting a list (Milestone 7), sending from a connected mailbox (Milestone 9).
- Build POST /api/campaigns/[id]/send (validate → scheduled or immediate sending) and POST /api/campaigns/send-due (Backend Schema §8 steps 4–6: resolve list members, exclude email_opt_out, create campaign_recipients, send via Nodemailer, record 'sent' events).
- Run the one-time cron.schedule registration for real (Backend Schema §8) against this environment if not already done in Milestone 2 with a placeholder URL — update app.settings.app_url to the current deployment URL now that it's stable enough to schedule against.
- Build GET /api/track/open/[token].gif, GET /api/track/click/[token], GET /api/unsubscribe/[token], and POST /api/webhooks/sendgrid exactly per Backend Schema §9 — all four call record_campaign_event() and none of them require a Supabase session.
- Build the campaign detail/reporting view showing recipient-level status and the aggregate open/click/bounce/unsubscribe counts.
**Checkpoint:**
- Human verification required — send a real test campaign to a small, controlled list of real inboxes you control (2–3 addresses across providers is enough). Confirm: the email arrives and matches the composed content; opening it records an 'opened' event; clicking a link both redirects correctly and records a 'clicked' event; using the unsubscribe link records 'unsubscribed' and the contact's email_opt_out flips to true; a deliberately-bad test address (or SendGrid's bounce simulation) produces a 'bounced' event via the webhook.
- Claude Code: after the human test above, query campaign_events directly and confirm the event log matches what was actually done — this is the closest thing this milestone has to an automated check.

## 14. Milestone 11 — Dashboard, Reporting & CRO Leader Admin View

**Goal:** the single reporting view required by PRD §6.7, and the CRO Leader's cross-account admin dashboard required by PRD §6.8.
- Build the MSP dashboard (App Flow Document §4.3): pipeline summary by stage, recent activity, whatever else the App Flow Document specifies — as a set of direct Supabase aggregate queries under RLS (Backend Schema §11), not a server route, since there's no secret involved.
- Build the reports screen and GET /api/reports/export (ExcelJS, Backend Schema §10) for the one Phase 1 reporting view — revenue/ROI calculated from opportunities.value, never self-reported (PRD §6.7).
- Build the CRO Leader admin dashboard: cross-account visibility, account list/switcher, and POST /api/accounts (new MSP account creation + initial Owner invite, Backend Schema §10) — CRO Admin only, per the permission matrix.
**Checkpoint:**
- Claude Code: manually tally opportunity values and activity counts for the Milestone 6–8 test data via direct SQL, compare against what the dashboard displays, confirm they match exactly.
- Human verification: log in as the CRO Admin test user, create a second test MSP account through the new-account flow, confirm it appears correctly isolated from the first account's data everywhere in the app.

## 15. Milestone 12 — QA Pass, Accessibility & Polish

**Goal:** every screen matches the Design System precisely, and the manual QA checklist (§17) passes in full — the last gate before production.
- Sweep every screen built in Milestones 4–11 against the Design System: color usage (semantic mapping, §3.7), spacing (§5), elevation/radius (§6), and especially focus states (§7) — keyboard navigation and visible focus rings on every interactive element, since there's no automated accessibility test to catch a missed one.
- Confirm every list/table screen uses the shared empty/loading/error state components from Milestone 5 rather than an ad hoc one that crept in under deadline pressure.
- Responsive check at the breakpoints implied by the Design System/App Flow Document — this is a CRM used at a desk most of the time, but the sidebar/top bar collapse behavior still needs to work.
- Run through the manual QA checklist (§17) in full and fix anything it surfaces.
**Checkpoint:**
- Human verification required for the whole milestone — this is fundamentally a visual and interaction review, not something Claude Code can self-certify. Sign-off on the §17 checklist is the explicit gate to proceed to Milestone 13.

## 16. Milestone 13 — Production Deployment & Handoff

**Goal:** GrowthOS live on the client's production domain, verified end to end, with a clean handoff.
- Confirm Prereq #9 (production domain, DNS pointed at Vercel) and assign the domain in the Vercel project.
- Re-run the ALTER DATABASE ... SET app.settings.app_url statement (Backend Schema §8) with the final production URL — the send-due-campaigns cron job and every tracking/webhook link depend on this being correct, so this step has to happen before any real campaign goes out from production.
- Update the SendGrid Event Webhook URL (Prereq #8) to the production domain, and update both OAuth apps' (Prereq #5–6) redirect URIs from the preview URL to the production URL.
- Confirm every environment variable from the running .env.example checklist (Milestone 1, step 7) is set in Vercel's production environment — walk the list item by item rather than trusting memory.
- Delete the throwaway RLS-proof test route from Milestone 3 if it's still present.
- Deploy to production.
- Run a full smoke test directly against production: log in as a real (or realistic test) user of each MSP role and the CRO Leader role, create a contact, move an opportunity across the board, build a list, and send one real campaign end to end with real tracking — the same shape of test as Milestones 4–11's checkpoints, but now against the real domain, real DNS-authenticated sending, and real OAuth redirect URIs, all of which are the things most likely to break only in production even when everything worked in preview.
**Checkpoint:**
- Human verification required — production go-live sign-off. Once the smoke test in step 7 passes and the client confirms, the build is complete.
- Deliver: a short README covering local setup, the environment variable list, and how to re-run migrations, plus the Post-Launch Handoff checklist (§18).

## 17. Manual QA Checklist

Run this in full during Milestone 12, and again as the Milestone 13 smoke test (against production, with a narrower real-data version of the same checks). Organized by area, tracing back to the requirement each check is verifying.
**Authentication & access control** (PRD §4, Backend Schema §2–3)
- Each of the 8 roles can log in and lands on the correct default screen (MSP portal vs. CRO Leader admin dashboard).
- Invite → set password → login works for a freshly invited user.
- A deactivated user's session is actually cut off (not just hidden from the user list) — deactivate a logged-in test session and confirm its next request fails.
- Nav items shown match the Backend Schema §2 permission matrix, per role.
- A non-admin cannot change their own role (attempt it directly against the API, not just through the hidden UI control).
- An msp_read_only user sees every edit control disabled/hidden across contacts, companies, opportunities, and activities.
**Multi-tenant isolation** (Backend Schema §2, §6)
- An MSP user of Account A cannot see Account B's contacts, opportunities, campaigns, or users — by direct API/query attempt, not just absence from the UI.
- A CRO Leader role can see and (for Admin/Advisor) edit both accounts' data.
- cro_service_team can view across accounts but cannot edit anything outside the resources the matrix grants.
**Companies & contacts** (PRD §6.1–6.2)
- CSV and XLSX import both work; the column-mapping step handles a misordered/renamed header row correctly.
- Importing a row with an email that already exists in the account is rejected with a clear message, not a raw database error.
- Importing a row whose domain matches an existing company auto-links to it rather than creating a duplicate.
- Manual entry enforces the same dedup rule as import.
- merge_companies correctly reassigns every affected contact and opportunity, and the losing company record disappears from active lists everywhere.
- Every one of the 14 default contact statuses is present on a new account; a custom status can be added, renamed, and archived.
**Lists & segmentation** (PRD §6.3)
- A static list's membership only changes via explicit add/remove.
- A smart list's membership updates correctly when a matching field changes on a contact, with no manual refresh action needed beyond reloading the view.
- Every field/operator combination the UI exposes actually filters correctly — spot-check at least one of each of the five operators (eq, neq, contains, before, after).
**Opportunities & activities** (PRD §6.4–6.5)
- All 13 stage columns render in the correct left-to-right order on the board.
- Dragging a card to a new column persists after a full page reload.
- An opportunity is never deletable or archivable anywhere in the UI — confirm no control exists for it.
- Logging a call/email/meeting/task/note from either the contact or the opportunity screen shows up correctly on both.
- A task's due date and completion toggle both work and are reflected wherever tasks surface.
**Email connections & campaigns** (PRD §6.6, Backend Schema §8–9)
- Both a Google Workspace and a Microsoft 365 mailbox connect successfully; disconnecting one and reconnecting works cleanly.
- A scheduled campaign actually sends at its scheduled time (not just when manually triggered) — wait for a real cron tick during testing rather than only testing the immediate-send path.
- Every recipient on the target list who isn't opted out receives the email; an opted-out contact is correctly excluded.
- Open, click, bounce, and unsubscribe all record the correct event type and update the recipient's rolled-up counters.
- The unsubscribe link actually sets email_opt_out, and that contact is excluded from the next campaign sent to the same list.
- CAN-SPAM footer/unsubscribe link is present on every sent campaign.
**Dashboard & reporting** (PRD §6.7)
- Dashboard pipeline-by-stage summary matches a manual count.
- Revenue/ROI figures are computed from opportunities.value, never from any self-reported field.
- The report export produces a correctly formatted XLSX/CSV matching what's shown on screen.
**Cross-cutting**
- Every empty state, loading state, and error state (Design System §8.11) has actually been triggered and looked at, not just assumed to work from the component existing.
- Keyboard-only navigation reaches every interactive element with a visible focus state (Design System §7).
- The app is usable at a narrow desktop/laptop width — full mobile optimization isn't required for Phase 1 (no native mobile app, per PRD scope), but a collapsed sidebar shouldn't break anything.

## 18. Post-Launch Handoff

Deliverables at the end of Milestone 13, alongside the deployed application:
- **README**: local dev setup, environment variable reference (cross-linking Tech Stack Lockfile §7 and Backend Schema Document §12 item 8), how to run and roll back a migration, and how the pg_cron job and TOKEN_ENCRYPTION_KEY/CRON_SECRET secrets are managed.
- **Open items register**: a single list pulling together every open item already on record across the series — Backend Schema Document §12, App Flow Document §7, and any assumption flagged during this plan's own execution — so nothing gets lost between "flagged during the build" and "the client's actual backlog."
- **Monitoring**: Phase 1 has no dedicated observability tooling in the Tech Stack Lockfile. At minimum, confirm the client knows where to look when something breaks — Vercel's function logs (for API route errors, including failed campaign sends) and Supabase's own logs/dashboard (for RLS denials, slow queries, and pg_cron job history via cron.job_run_details).
- **Access handoff**: confirm the client (not just the individuals who set up the accounts during this build) has admin access to Vercel, Supabase, SendGrid, and both OAuth app registrations — this build depended on five separate third-party accounts, and losing access to any one of them post-launch stalls anything from a routine key rotation to an incident response.

## 19. Assumptions & Open Items

- **Milestone granularity assumes single-threaded, sequential work.** If the client's dev team wants to parallelize (e.g., Milestones 6 and 9 don't actually depend on each other), the dependency column in §3 shows exactly where that's safe — everything downstream of Milestone 3 that only touches its own feature area can, in principle, be reordered or split across people, with Milestone 12 as the point everything has to converge again.
- **No automated testing** was a deliberate, confirmed choice for Phase 1, consistent with the Tech Stack Lockfile's already-locked dev tooling — §17's manual checklist is the compensating control. If the client's risk tolerance changes before or during the build, adding Vitest/Playwright is a Tech Stack Lockfile amendment, not just a plan change, and should go back through that document rather than being added ad hoc here.
- **Production-only environment** (no persistent staging) was the confirmed choice for Phase 1 budget reasons. Vercel's automatic per-PR preview deployments (each pointed at the same single Supabase project, since there's no second database) are the practical substitute — worth flagging that this means preview testing during the build shares state with whatever's already in that one Supabase project, so test data created in early milestones will still be present (and visible) during later milestones' checkpoints. That's treated as a feature here (it's how several checkpoints above cross-reference earlier milestones' test data), but it does mean there's no clean-slate database until the client is ready to provision a real staging environment post-launch.
- **Milestone 9's OAuth scope (email/profile only, not mail-send)** follows directly from the Tech Stack Lockfile's decision to route all sending through SendGrid regardless of which mailbox is "connected" — this document didn't introduce that scope choice, just made explicit what it implies for the OAuth consent screens the client needs to configure.
- **Vercel linked from Milestone 1** (rather than only at deployment) is this plan's own structural decision, not something the prior documents specified — it exists purely so every milestone checkpoint has a reviewable URL rather than requiring npm run dev on someone's machine. If the client would rather keep Vercel out of the loop until go-live, Milestones 1–12 still work identically against local dev servers; only the "human verification" checkpoints that currently say "open the preview URL" would need to say "run it locally" instead.
