> **GROWTHOS** Product Requirements Document — Phase 1: CRM Foundation
# GrowthOS Product Requirements Document

Prepared for CRO Leader · Draft v1 · Based on the _GrowthOS Functional Vision_, _GrowthOS Developer Brief_, and client answers to the open-questions review


## 1. Executive Summary

GrowthOS is a profile-driven growth operating system for Managed Service Providers (MSPs), built by CRO Leader to replace its current use of **GlassHive CRM** and to eventually deliver the full vision described in the source documents: an onboarding-profile-driven recommendation engine, a dynamic 14-step growth plan, a four-quarter roadmap, and AI-guided next-best-actions.
This PRD scopes **Phase 1** in build-ready detail: a web-based, multi-tenant CRM that centralizes MSP prospects, contacts, opportunities, activities, and email outreach, with a CRO Leader administrative view across all client accounts. Later phases (AI recommendation engine, CallForce, AdvocateDash, website assessment, client-facing portal, LinkedIn integration, billing) are summarized as roadmap so the team understands where Phase 1 is heading without inflating the current build.

## 2. Goals & Success Metrics

**Primary goal.** Replace GlassHive with a purpose-built CRM that CRO Leader owns and can extend toward the full GrowthOS vision, without taking on cost or scope the team can't support in month one.
**Phase 1 success metrics:**
- Number of MSP accounts onboarded and actively using GrowthOS in place of GlassHive
- Reduction in CRO Leader staff time spent on manual account management (tracked informally at first — see §11)
- Successful import of existing GlassHive prospect/contact data with zero data loss
- Email campaigns sent, opened, and clicked, tracked with timestamps
These are intentionally lightweight for Phase 1. A dedicated analytics/reporting layer with role-based dashboards is out of scope until a later phase (§10).

## 3. Scope Overview

| **Area** | **Phase 1** | **Later phase** |
| --- | --- | --- |
| Multi-tenant CRM (prospects, contacts, opportunities, activities) | **Yes** | — |
| Custom prospect statuses | **Yes** | Custom fields / pipelines, later |
| Lists & segmentation | **Yes** | — |
| Spreadsheet import & manual entry | **Yes** | Purchased data feeds, intent data automation |
| Email account integration (Microsoft 365 & Google Workspace) | **Yes** | Calendar/Teams sync, SSO |
| Email sending, campaigns, open/click tracking | **Yes** | Deliverability optimization, A/B testing |
| CRO Leader admin dashboard (all MSP accounts) | **Yes** | Cross-account analytics |
| MSP's own account portal (their own CRM view) | **Yes** | — |
| Reporting export (spreadsheet) | **Yes** | BI platform integrations |
| Onboarding profile | Basic version, single pass | Recommendation engine, versioning, quarterly re-assessment |
| 14-step growth plan / four-quarter roadmap | No | Yes |
| AI recommendation engine | No | Yes |
| CallForce (dialing-hour blocks) | No — manual tracking only, later phase | Yes, with consumption workflow |
| AdvocateDash | No | Yes, as a separate mobile app |
| LinkedIn integration | No | Yes |
| Website Assessment module | No | Yes |
| MSP's end-client portal | No | Yes |
| Content/marketing management (lightweight CMS) | No | Yes |
| Billing / payments inside the app | No | Not yet scoped |
| Native mobile app | No (CRM is web-based) | AdvocateDash only |


## 4. Users, Roles & Permissions

GrowthOS Phase 1 uses the roles from the Developer Brief, formalized into a permission matrix. MSPs can invite their own additional users; CRO Leader Admins and Advisors have blanket access across **all** MSP accounts (not assigned per-client).
| **Role** | **Own account data** | **Other MSPs' data** | **Manage users (own account)** | **Admin dashboard (all accounts)** |
| --- | --- | --- | --- | --- |
| MSP Owner | Full (view/edit/delete) | None | Yes | No |
| MSP Admin | Full (view/edit/delete) | None | Yes | No |
| MSP Sales User | View/edit prospects, contacts, opportunities, activities | None | No | No |
| MSP Marketing User | View/edit lists, campaigns, prospects | None | No | No |
| MSP Read-Only User | View only | None | No | No |
| CRO Leader Admin | Full, across all accounts | Full | Yes | Yes |
| CRO Leader Advisor | View/edit, across all accounts | View/edit | No | Yes |
| CRO Leader Service Team Member | View, across all accounts (as needed for service delivery) | View | No | Limited |

Notes:
- MSP technicians are **not** a supported access tier in Phase 1 — no login is provisioned for them.
- Pricing is intended to scale per user count; the billing mechanism itself is out of scope for Phase 1 (§10), so seat counts should be tracked in-app even though invoicing happens outside GrowthOS for now.
- Authentication: standard email/password plus OAuth against Microsoft 365 and Google Workspace (needed anyway for email integration, §7). Formal SSO/Entra ID federation is not required for Phase 1.

## 5. Company (Tenant) Environments

Each MSP has its own isolated environment: users, prospects, contacts, lists, opportunities, activities, and campaigns are scoped to that MSP and never visible to another MSP. CRO Leader Admins and Advisors see across all environments from a single administrative dashboard rather than logging into each one separately (per the Developer Brief's original intent, retained for Phase 1).
Technical isolation is **application-level** (tenant ID scoping with row-level security), not separate databases per tenant — the client confirmed no contractual or compliance driver requires stricter isolation at this stage (§9).

## 6. Phase 1 Functional Requirements


### 6.1 Prospect & Contact Management

The system must store, for each prospect/company and its contacts:
- Company name, website, industry, geography, company size
- Contact name, title, email, phone
- Assigned owner (MSP user)
- Status (see §6.2), notes, associated activities, associated opportunities, list memberships
- Source of the record (import, manual entry)
**Import & entry.** Prospects and contacts can be added by spreadsheet import (CSV/XLSX, mapped to these fields) or manual entry. This is also the path for migrating existing GlassHive data.
**Deduplication.** A contact is treated as a duplicate — and blocked from being created twice — when its **email address** exactly matches an existing contact. Company-level fuzzy matching (name/domain) is not required for Phase 1.
**Scale.** MSP prospect/contact lists commonly run into the tens of thousands of records; the data layer and search/filtering must remain responsive at that volume per MSP tenant.

### 6.2 Prospect Status Tracking

Prospects move through a status pipeline (Suspect, Prospect, Contacted, Engaged, Appointment Scheduled, Opportunity Created, Client Won, Lost, Nurture, etc., per the Functional Vision). MSPs can define **custom statuses** in addition to the defaults — this is confirmed in-scope for Phase 1. Custom fields, custom pipelines, and custom object types beyond statuses are deferred.

### 6.3 Lists & Segmentation

A prospect can belong to multiple lists at once (e.g., "Manufacturing Prospects," "Q1 Webinar Invite List"). Lists support manual add/remove and criteria-based (saved-filter) population, so MSPs can build outreach strategies around shared characteristics.

### 6.4 Opportunity Management

Opportunities move through the stage pipeline defined in the Developer Brief (Identified Interest → Discovery → Proposal → Negotiation → Closed Won/Lost, etc.). Requirements:
- Opportunities can be created manually or automatically when a prospect shows meaningful interest (e.g., meeting booked)
- **All opportunities are retained permanently** — none are deleted or archived — and must be sortable/filterable by stage
- Opportunity value feeds revenue reporting (§6.8)

### 6.5 Activity Timeline

Every prospect/contact record shows a unified, chronological timeline of calls, emails, meetings, tasks, and notes, so any user can immediately see engagement history and what's needed next.

### 6.6 Email Integration & Campaigns

This is the largest single piece of Phase 1 functionality and should be scoped and estimated carefully.
**Account integration.** Users connect their own mailbox — **Microsoft 365 or Google Workspace** — via OAuth. Only email send/receive/history association is required for Phase 1 (no calendar or Teams sync yet).
**Sending.** GrowthOS sends email on the user's behalf from within the app (one-off emails and campaigns to a list), rather than only logging emails sent elsewhere. This requires:
- Deliverability infrastructure (SPF/DKIM/DMARC-aligned sending, sender reputation management, IP/domain warm-up)
- Unsubscribe handling and CAN-SPAM compliance (footer, opt-out honored automatically)
- **Open and click tracking**, each recorded with a timestamp, associated back to the contact and campaign
**Recommendation.** Given the limited budget, GrowthOS should send through a transactional/marketing email API (e.g., Postmark, SendGrid, or Amazon SES) rather than building mail-transfer infrastructure from scratch. The sending experience is still entirely inside GrowthOS from the user's point of view; the ESP is an implementation detail that buys deliverability and tracking without months of infrastructure work. **This should be confirmed with the client before build.**
SMS is explicitly **not** in scope (no A2P 10DLC/TCPA burden to take on). Direct mail is not in scope beyond what's noted in §10.

### 6.7 Reporting & Export

- Revenue/ROI figures are calculated from opportunity values recorded in the CRM (not self-reported)
- No role-specific dashboards for Phase 1 — one reporting view is sufficient
- Weekly and monthly sales/marketing KPI summaries (leads, opportunities, campaign performance) are a Phase 1 nice-to-have
- Reports export to Excel/spreadsheet; no BI platform integration yet

### 6.8 CRO Leader Admin Dashboard & MSP Portal

Phase 1 needs exactly two views, not three:
- **CRO Leader admin dashboard** — CRO Leader Admins/Advisors see and can act across all MSP accounts from one place
- **MSP's own portal** — a registered MSP sees only its own CRM data
A separate, third-tier portal for the _MSP's own clients_ (accept/reject leads, view basic reports) is explicitly deferred (§10) — it is a different audience with its own auth and branding needs that shouldn't be conflated with Phase 1.

### 6.9 Audit & Account Lifecycle

- User records show **last login timestamp** only — no full audit trail (who viewed/edited/exported what) is required for Phase 1
- Data is retained indefinitely, including for cancelled/offboarded MSP accounts; formal data-export/deletion policies can wait until the user base is larger

## 7. Data Model Overview

At a minimum, Phase 1 needs these core entities: **MSP Account (tenant)**, **User**, **Company/Prospect**, **Contact**, **List**, **List Membership**, **Opportunity**, **Activity** (call/email/meeting/task/note), **Email Campaign**, **Email Send Event** (open/click/timestamp), **Custom Status Definition**. Each is scoped to an MSP Account except platform-level records (User roles at the CRO Leader level).

## 8. Non-Functional Requirements


### 8.1 Recommended Technology Stack

No stack is mandated by the client; the following is recommended specifically for a small team building a cost-minimal MVP in about a month:
| **Layer** | **Recommendation** | **Why** |
| --- | --- | --- |
| Frontend | React (Next.js) + TypeScript | Fast to build, huge hiring pool, deploys cheaply |
| Backend | Node.js/TypeScript (Next.js API routes or NestJS) | One language across the stack; fewer moving parts for a small team |
| Database | PostgreSQL (Supabase or Neon) | Generous free/low-cost tiers; built-in row-level security fits the multi-tenant model in §5 |
| Auth | Supabase Auth or Clerk, with Microsoft & Google OAuth | Needed anyway for email account integration (§6.6) |
| Hosting | Vercel (app) + Supabase (DB/auth/storage) | Near-zero infrastructure ops, scales automatically, low starting cost |
| Email sending | Postmark or SendGrid | Deliverability + native open/click tracking (§6.6) |
| File storage | Supabase Storage (or S3-compatible) | Same low-cost tier as the database |

This combination keeps hosting and tooling costs minimal at launch and scales without a rebuild well past the 50-user mark noted below. **This is a recommendation, not a decision — please confirm before build starts.**

### 8.2 Scale, Performance & Availability

- Launch target: comfortably support at least 50 users, with room to grow into the low hundreds without re-architecture
- Per-tenant prospect/contact volume in the tens of thousands (§6.1)
- No formal uptime/SLA commitment is required for Phase 1

### 8.3 Platform & Browser Support

No requirement was specified; recommended baseline: latest two versions of Chrome, Edge, Firefox, and Safari, desktop-first responsive layout (down to tablet width). No offline support is needed — Phase 1 is CRM only; AdvocateDash's offline/field-use needs belong to its own later, separate mobile app (§10).

### 8.4 Security & Compliance

No formal certification (SOC 2, GDPR, CCPA) is required at this stage. Baseline hygiene should still apply as standard practice, not as a compliance program: encryption in transit and at rest (default on the recommended hosting stack), hashed/OAuth-based authentication, and tenant data isolation via row-level security (§5). This should be revisited as the user base and any compliance obligations grow.

## 9. Integrations Summary (Phase 1)

- **Microsoft 365** — email account connection only (send/receive/history)
- **Google Workspace** — email account connection only, same scope as Microsoft 365
- No calendar/Teams sync, no SSO/Entra ID federation, no public GrowthOS API, and no LinkedIn integration in Phase 1

## 10. Roadmap: Beyond Phase 1

Documented here at a lower level of detail, as confirmed — full specification is deferred until Phase 1 ships.
| **Phase** | **Scope** |
| --- | --- |
| Phase 2 | Onboarding profile deepened; recommendation-rule groundwork; lightweight CMS for content/marketing |
| Phase 3 | 14-step growth plan & four-quarter roadmap modules |
| Phase 4 | AI recommendation engine (model choice open to the dev team, §per client answer); explainable "why this recommendation" UI (left to design) |
| Phase 5 | Website Assessment module — recommended approach: build on an existing scoring API (e.g., Google PageSpeed Insights/Lighthouse) plus a custom checklist, rather than a from-scratch analysis engine, to keep cost down |
| Phase 6 | CallForce (dialing-hour blocks, purchased and manually reconciled by CRO Leader — no in-app payment processing), AdvocateDash (contracted local reps; native mobile app, separate from the web CRM; geographic routing likely needed) |
| Later | LinkedIn integration; MSP end-client portal (white-labeling TBD); billing/payments inside the app; public API; formal compliance program if/when required |


## 11. Assumptions & Open Items

These were flagged during the questions review as uncertain or deferred by the client and should be revisited before or during the phase where they become relevant, rather than blocking Phase 1:
- AI usage costs and data-privacy handling for a third-party AI provider — not yet relevant until Phase 4, but worth scoping early given it affects architecture
- How "budget guidance" dollar figures get calculated (fixed formula vs. AI-generated narrative) — a Phase 4 design question
- Email-sending approach (§6.6) is a recommendation pending client confirmation
- Technology stack (§8.1) is a recommendation pending client confirmation
- Website Assessment tooling approach (§10) is a recommendation pending client confirmation
- One-month timeline for the full scope in §6 is achievable but tight — email sending/campaigns with deliverability and tracking (§6.6) is typically the largest line item; if the timeline slips, that is the section most likely to need to flex into a fast-follow rather than launch day one

## 12. Explicit Out of Scope — Phase 1

Stated plainly to prevent scope creep during the Phase 1 build:
- No native mobile app (web-based CRM only; AdvocateDash's app is a separate, later effort)
- No billing or payment processing inside the app
- No AI recommendation engine, 14-step plan, or four-quarter roadmap
- No CallForce or AdvocateDash workflow modules
- No LinkedIn integration
- No MSP end-client portal
- No content/marketing management (CMS)
- No SMS outreach
- No public API or SSO/Entra ID federation
- No formal audit-logging or compliance program beyond baseline security hygiene
