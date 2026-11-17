# Program Reports in Intel — design

Client-confirmed 2026-11-16 (approved mockup "Program Reports Mockup",
https://claude.ai/artifact/Uc5b4ShegXSSno7oZpvP1P, version 3).

## Why

CRO Leader sells programs (ScoutLeads, TacticalLeads, ConquerLeads,
NationBuilder, plus the SniperLeads add-on). Subscribers should see, inside
Intel, a monthly report of what CRO Leader delivered for each program they
pay for, and be able to compare months. CRO Leader types the numbers each
month (the outreach runs in outside tools) and publishes; clients see a month
only once it is published.

## Decisions (client's)

- One report per program. Only programs CRO Leader switches on for an account
  show; a program that is off shows nothing at all (no teaser).
- Every user in the account can see a published report.
- Only the CRO Leader team publishes (CRO Admin and CRO Advisor). Published
  months can be edited and republished.
- Numbers are actuals only (no targets). No dollar figures, industry
  breakdowns or ranked company lists (standing rule).
- Comparison: this month vs last month (▲/▼) and a month-by-month table.
  No trend column.
- Dashboard plus a downloadable PDF. No written notes on the TacticalLeads
  report.
- TacticalLeads deliverables (the yellow rows): MQCs, Email Campaigns, Email
  Warmup, Live Activity Monitoring, LinkedIn. CRM is left off.
- MQCs added is counted automatically by GrowthMission. Every other
  TacticalLeads number is typed (the campaigns run in an outside tool).
- SniperLeads keeps the report already built (2026-10-30), shown in Intel as
  a dashboard. Its Copy for Outlook / PDF export stays.
- ScoutLeads, ConquerLeads and NationBuilder reports are parked. MissionLink
  is dropped.

## Build

**Data**
- `account_programs (account_id, program, start_month, active)` — one row per
  account per program; the single record of who subscribes to what. Programs
  now: `sniper_leads`, `tactical_leads`. Readable by the account itself (so
  Intel knows which tabs to show), written by CRO Admin only. The existing
  `sniperleads_clients` rows are copied in and the code moves over;
  `sniperleads_clients` is left in place, unused (nothing is hard-deleted).
- `tactical_reports` — one row per account per month, typed columns for each
  number, `gm_numbers` (the MQC count, fixed at first publish), and
  `published_at/by`. CRO Admin/Advisor read and write everything; the account
  reads only published rows.
- `sniperleads_reports` gains `published_at/by` and the same "account reads
  published rows" policy. Publishing fixes `gm_numbers` like Export does.
- `tactical_numbers(account, month)` — MQCs added: distinct live contacts
  added to the account's live lists during that month (UTC).

**Intel** (`/reports`)
- When the account has at least one program on, tabs appear under the page
  header: Account (today's page, unchanged), then SniperLeads / TacticalLeads.
- A program tab has a month picker (published months only), "Compare with
  <previous month>", Download PDF, a headline band, one card per deliverable,
  and a Month by Month table (up to the last 12 published months).

**CRO Leader Dashboard** (`/cro`)
- Clients list: the SniperLeads crosshair button becomes a Programs button;
  its dialog switches each program on/off with a start month (CRO Admin).
- New section "TacticalLeads Reports" (CRO Admin, CRO Advisor): month picker,
  list of TacticalLeads accounts with Not started / Draft / Published, and an
  editor grouped by deliverable with Save draft, Publish to client, Unpublish.
- SniperLeads Reports editor gains Publish to Intel / Unpublish.

## Builder's calls (flag on review)

- SniperLeads and TacticalLeads entry stay in two sections instead of the
  mockup's single combined list, so the existing SniperLeads editor
  (Outlook copy, wording, signer) is not rebuilt.
- "Preview as client" from the mockup is not built; the CRO team can enter the
  account and open Intel to see the published view.
- The Programs dialog lists only programs that have a report (SniperLeads,
  TacticalLeads). The parked programs get added with their reports.
- MQCs counts every contact added to the account's lists that month,
  whoever added it (lists loaded by SQL have no `added_by`).
- Delta compares with the previous calendar month; if that month has no
  published report, it says so instead of comparing.
