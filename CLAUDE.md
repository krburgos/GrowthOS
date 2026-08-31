# CLAUDE.md — GrowthOS

This file is read automatically at the start of every Claude Code session in this repository. It governs how work on GrowthOS gets done.

## Before any task

Read the relevant reference documents in `docs/` in full before writing code, not just this summary. This file exists to keep the most load-bearing rules visible at a glance — it is not a substitute for the specs themselves, and it will drift out of date if treated as one.

| Document | File | Covers |
| --- | --- | --- |
| Product Requirements Document | `docs/product-requirements.md` | Scope, roles, functional requirements, what's explicitly out of scope |
| App Flow Document | `docs/app-flow.md` | Every screen, navigation structure, user journeys, empty/error states |
| Tech Stack Lockfile | `docs/tech-stack-lockfile.md` | Every dependency pinned to an exact version; install nothing that isn't listed here without updating it first |
| Design System | `docs/design-system.md` | Colors, type, spacing, every component spec — the only source of visual decisions |
| Backend Schema Document | `docs/backend-schema.md` | Every table, RLS policy, function/trigger, API endpoint |
| Implementation Plan | `docs/implementation-plan.md` | The milestone sequence this build follows, in order, with checkpoints |

Start every session by checking the Implementation Plan for which milestone is current, and re-read that milestone's own section before starting work on it.

## The rule that matters most

**Do not make an architectural, product, or design decision that contradicts anything in these six documents.** They represent decisions the client has already made — reopening one silently, even to "improve" it, throws away a real decision someone signed off on.

If a task can't be completed without deviating from what's written — the spec is ambiguous, two documents conflict, or the only viable implementation contradicts a stated requirement — **stop and flag it before proceeding.** State plainly: what the documents say, why it can't be followed as written, and what the options are. Do not pick one silently and move on, even if one option is obviously better engineering. This mirrors how these documents themselves were built — every judgment call in them is listed in an Assumptions & Open Items section rather than left implicit, and this repo should hold to the same standard.

A gap is different from a contradiction: if a document is simply silent on something (no existing decision to preserve), it's fine to make a reasonable call and note it — but still say so, the same way each document's own Open Items section does, rather than leaving it undocumented.

## Non-negotiables (quick reference — the full reasoning is in the source documents)

- **Multi-tenancy is RLS-enforced on a single shared schema** — not separate databases per tenant (Backend Schema §2). Every tenant-scoped table carries `account_id`; every query path must respect it.
- **Soft delete everywhere, with one exception.** Nothing is hard-deleted — `archived_at`, no `DELETE` RLS policies. **Opportunities are the one exception**: no `archived_at` column at all, retained permanently, never archived (PRD §6.4, Backend Schema §5.5). Don't add deletion to either without flagging it first.
- **Hybrid data access**: direct browser-to-Supabase under RLS for simple CRUD; a Next.js API route with the service role only for secrets or multi-step server logic (Backend Schema §11). Don't default to routing everything through an API route, and don't put a secret-touching operation directly in client code.
- **Every dependency is pinned to the exact version in the Tech Stack Lockfile.** Don't `npm install` something newer or substitute a different library without updating that document first and flagging the change.
- **No automated test suite for Phase 1** — deliberate, confirmed with the client (Tech Stack Lockfile §3.9, Implementation Plan §19). Don't introduce Vitest/Playwright/etc. on your own judgment; the Implementation Plan's manual QA checklist (§17) is the compensating control. If test coverage genuinely seems necessary for a specific piece of work, flag it rather than adding a test framework unilaterally.
- **Email connections (OAuth) are strictly single-user, no CRO Leader bypass** — not even for admin roles (Backend Schema §6.3). This is a deliberate exception to the otherwise-broad CRO Leader access pattern; don't "fix" it into consistency with the rest of the permission matrix.
- **Campaign sending goes through SendGrid SMTP relay via Nodemailer regardless of which mailbox is connected** — the OAuth connection verifies identity, it does not send mail via the provider's own API (Tech Stack Lockfile §5.2, Implementation Plan §12 item 4). Don't implement Gmail/Graph send APIs.
- **The client portal, file attachments, custom fields/pipelines, and an audit log are all explicitly out of scope for Phase 1** (PRD §10, Backend Schema §12, App Flow Document §7). Don't build toward any of them "since it's easy while I'm in here" — that's scope creep the PRD specifically called out to prevent.
- **Design tokens come only from `docs/design-system.md` §9** (the Tailwind `@theme` block). No one-off hex values, spacing, or font sizes invented per-component.

## Working within a milestone

The Implementation Plan (§1, "How to Use This Document") expects work to proceed one milestone at a time, each ending in a checkpoint before the next starts. Don't skip ahead to a later milestone's work because it seems related or convenient — dependencies between milestones are listed for a reason (e.g., campaign sending in Milestone 10 depends on lists from Milestone 7 and OAuth from Milestone 9 both being done first).

When a milestone's checkpoint calls for **human verification**, that step is not something to self-certify and move past — stop and wait for confirmation.

## Cross-document conflicts

These six documents were written sequentially, each building on the ones before it, and were checked for consistency at each step — but if a real conflict between two of them turns up during implementation (a field named differently, a permission that doesn't match between the PRD's role table and the Backend Schema's RLS policies, etc.), treat that as exactly the kind of thing to flag rather than silently resolve by picking whichever one seems more recently written.
