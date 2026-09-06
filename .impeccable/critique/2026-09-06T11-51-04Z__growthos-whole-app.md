---
target: GrowthOS (whole app)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\USER\\OneDrive - croleader.com\\Desktop\\GrowthOS\\GrowthOS (whole app)"
timestamp: 2026-09-06T11-51-04Z
slug: growthos-whole-app
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | The notification bell always shows a hardcoded red "unread" dot regardless of real state (top-bar.tsx) |
| 2 | Match System / Real World | 3/4 | Domain vocabulary is strong; "Bounced: 0" reads identically whether it's a real zero or an unwired Milestone-10 placeholder |
| 3 | User Control and Freedom | 3/4 | Contact Overview form has no Cancel/Discard — it's permanently in edit mode |
| 4 | Consistency and Standards | 3/4 | Bulk-action toolbar hand-rolls pill buttons and a literal "▾" glyph instead of the shared Button component and a lucide icon |
| 5 | Error Prevention | 3/4 | Zod validation, duplicate-email checks, and import-blocks-on-failure are solid |
| 6 | Recognition Rather Than Recall | 2/4 | Icon-only sidebar at every breakpoint forces memorizing 7 abstract icons with only a hover tooltip as a hint |
| 7 | Flexibility and Efficiency | 2/4 | No filter bar, saved views, or column show/hide anywhere in Contacts/Opportunities/Lists |
| 8 | Aesthetic and Minimalist Design | 3/4 | Density is intentional and spec-justified, but sparse records show a wall of "—" placeholders across 18 columns |
| 9 | Error Recovery | 2/4 | Raw Postgres/Supabase error strings surface directly via `toast.error(error.message)` in most mutations |
| 10 | Help and Documentation | 1/4 | Disabled Settings rows (Billing, 2FA, Custom Fields, etc.) give zero explanation of why they're disabled |
| **Total** | | **24/40** | **Acceptable — significant improvements needed before users are happy** |

### Design Specificity Verdict

**LLM assessment**: GrowthOS is specific in vocabulary and in its two most-worked screens (Contacts table, Opportunity stages) but generic in its shell. Domain-accurate terms (Score, Temp, Stage Group, MSP-flavored pipeline stages) and one genuinely opinionated dense table (18 columns, sticky Name/checkbox, per-column icons) show real authored intent. But the icon-rail + top-bar + content shell, the Kanban cards (contact/company/value only — no MSP-specific signal like service line or renewal date), and the login screen are the exact skeleton of any B2B SaaS admin tool since 2015. Verdict: domain-flavored template, not yet a bespoke MSP tool — a defensible Phase-1 tradeoff, not an execution flaw.

**Deterministic scan**: `impeccable detect` scanned 98 TSX files across `app/` and `components/` and found exactly **one** primary finding: a "side-tab accent border" (the classic AI-slop tell of a thick colored left border on a card) in `components/ui/sonner.tsx:22` (`border-l-4`). This is a shared toast component, not a page the redesign has touched. The scan otherwise came back clean — the codebase's Tailwind-token discipline evidently doesn't trip the mechanical anti-pattern rules. This is a case where the detector caught something the LLM review missed entirely (a toast wasn't in the reviewed screen list); it is not a false positive — the class is genuinely there and genuinely matches the described anti-pattern, though at low real-world severity since it's a bottom-corner toast, not a hero card.

**Visual overlays**: Not available this run — no browser-automation tool is exposed in this session, so live-page injection/overlay evidence could not be gathered. This assessment is source-code-based only.

### Overall Impression

The redesign work already shipped (navy command-bar tables, the teal "selected" rail repeated across sidebar/Settings-nav/table rows, fluid table widths) is real, coherent, and well-executed — it solved the specific "tables feel cramped" complaint it was built for. What it hasn't touched is the layer underneath: an icon-only sidebar with no accessible names, raw database errors reaching end users, zero ability to trim an 18-column table down to what a given role actually needs, and a login screen that puts the logo directly over a busy gradient in violation of the design system's own logo-usage rule. The single biggest opportunity is closing the gap between "looks modern" (done) and "operates safely and legibly for every role and every input" (not yet done) — none of it requires new visual direction, just extending the discipline already proven on the tables to the rest of the shell.

### What's Working

1. **Token-to-component traceability is real.** Every component checked traces back to exact values in `docs/design-system.md` §9, including explicitly-commented, justified deviations (e.g. badge fills darkened one step from spec). Unusually disciplined for a Phase-1 build.
2. **The "selected/active" visual language is genuinely unified.** The same secondary-500 left rail marks "current/selected" identically in the sidebar, the Settings nav columns, and Contacts table row selection — it reads as one system, not three teams' independent choices.
3. **Destructive-action safety is consistently implemented, not just specified.** Soft-delete-with-confirmation shows up correctly everywhere reviewed (contacts, lists, user deactivation) — no shortcut hard-deletes found anywhere, matching CLAUDE.md's non-negotiable rule.

### Priority Issues

**[P1] Login screen puts the full-color logo directly over a busy gradient, against the design system's own rule**
Why it matters: `docs/design-system.md` §2 states the full-color logo is "for white or near-white backgrounds only... don't place it over a busy photo/background." The auth-screen gradient background just shipped puts `growthos-logo.png` directly on top of a radial-gradient navy/teal glow on every auth screen (Login, Forgot Password, Reset, Accept Invite).
Fix: give the logo its own white/neutral-50 plate above the gradient, or move it inside the white card instead of above it.
Suggested command: `/impeccable polish`

**[P1] Icon-only sidebar links have no accessible name independent of the hover tooltip**
Why it matters: `components/shell/sidebar.tsx`'s nav `<Link>`s wrap only an `<Icon>` SVG with no `aria-label`. A Radix tooltip is a hover/focus-reveal pattern, not a guaranteed accessible-name mechanism — a screen-reader user tabbing through the primary nav for the entire app may hear only "link" seven times.
Fix: add `aria-label={item.label}` directly on the `Link`/disabled `span`, independent of the tooltip.
Suggested command: `/impeccable audit`

**[P1] Raw database error strings reach end users on nearly every mutation**
Why it matters: `toast.error(error.message)` passes the Postgres/Supabase error verbatim in `users-table.tsx`, `contacts-bulk-toolbar.tsx`, `image-upload-circle.tsx`, and `company-profile-form.tsx`. An RLS denial or constraint violation shows raw DB language an MSP user has no way to act on. The correct pattern already exists for one case (duplicate-email, code 23505) — it just isn't generalized.
Fix: a shared error-translation utility mapping known Postgres/Supabase codes to plain-language copy, used everywhere `toast.error` currently takes `error.message` directly.
Suggested command: `/impeccable clarify`

**[P1] No way to reduce the Contacts table's 18 columns to what a role actually needs**
Why it matters: Every role sees all 18 columns unconditionally. A Read-Only or Sales user has no way to hide fields (Company Address, LinkedIn, Mobile Phone) they never touch — the sticky-column/horizontal-scroll mitigation makes the density navigable, but doesn't reduce it.
Fix: a simple show/hide column menu, persisted per-user (even just localStorage for Phase 1).
Suggested command: `/impeccable optimize`

**[P2] Bulk-action toolbar bypasses the shared Button component and its own icon rules**
Why it matters: `contacts-bulk-toolbar.tsx` hand-rolls `rounded-full` pills with ad hoc fills instead of `radius-md` (§8.1), and uses a literal "▾" character instead of a lucide `ChevronDown` (§8.13) — on the one control cluster most likely to appear in a client demo.
Fix: rebuild the toolbar's buttons on the shared `Button` component/variants and swap the glyph for a lucide icon.
Suggested command: `/impeccable polish`

**[P2] Notification bell shows a permanent, unconditional "unread" dot**
Why it matters: The dot in `top-bar.tsx` is hardcoded on regardless of actual notification state — a persistently-lying status indicator that will train users to ignore it.
Fix: either wire it to a real unread-state source, or remove it until one exists.
Suggested command: `/impeccable harden`

**[P2] Disabled Settings rows give zero explanation**
Why it matters: Rows like Billing & Payments, Two-Factor Auth, and Custom Fields render as plain greyed text with no tooltip or "coming later" copy — a first-time Owner can't tell not-built-yet from broken from lacks-permission.
Fix: a short tooltip or inline caption on disabled rows explaining why.
Suggested command: `/impeccable clarify`

**[P3] Kanban cards have no visible keyboard focus-visible treatment**
Why it matters: `opportunity-card.tsx`'s draggable card gets `tabIndex`/`role` from dnd-kit but no `focus-visible:` ring, unlike the base Button/Input components — a keyboard user tabbing to a card gets no visual confirmation of focus, and dnd-kit's keyboard-drag path becomes effectively unusable without it.
Fix: add the app's standard `focus-visible:ring-secondary-500/40` treatment to the card.
Suggested command: `/impeccable harden`

### Persona Red Flags

**Alex (impatient power user)**: no filter bar or saved views anywhere in Contacts/Opportunities/Lists — "select all N matching" is undercut by having no way to narrow N in the first place beyond sort. The bulk toolbar's 6-8 simultaneous actions the instant one row is checked forces scanning a menu for a routine single-contact delete. Kanban drag persists immediately with no undo beyond a silent revert-on-error.

**Sam (accessibility-dependent, screen reader/keyboard-only)**: the sidebar's missing `aria-label`s (above) are the single clearest screen-reader blocker in the app, since it's the primary nav for everything. Kanban cards are technically keyboard-draggable via dnd-kit but have no visible focus state, making the keyboard path practically unusable even though it's wired correctly underneath. On the positive side: Hot/Cold temperature and Subscribed Yes/No both already pair color with a text label rather than color alone — that specific failure mode was checked for and not found.

**Jordan (confused first-timer)**: the icon-only sidebar with no persistent labels is the first wall after login — seven abstract icons, no text. Disabled Settings rows with no explanation will read as broken rather than intentionally out of scope. The always-editable Contact Overview form gives no signal about whether they're viewing or editing, unlike the Company Profile card's explicit view/edit toggle.

### Minor Observations

- `EmptyState` is a clean, correct, spec-compliant component — worth using as the reference pattern for the other gap-fill work above.
- The "Bounced" column on both Lists Index and the Contacts table is a hardcoded `0` placeholder pending Campaigns (Milestone 10) — correctly commented as intentional in code, but nothing in the UI itself distinguishes a real zero from a not-yet-implemented one.
- The Contact Overview form's Score field is a bare number input with no min/max — nothing stops an out-of-range value, while the table's score-bar silently clamps it on display without telling the user their entry was out of range.
- The hash-based avatar coloring in the Contacts table is a nice, low-complexity touch that adds real scannability to the dense table.
- `components/ui/sonner.tsx:22` carries a `border-l-4` "side-tab accent" — the one deterministic-scanner finding, on a shared toast component the redesign hasn't touched.

### Questions to Consider

- The Contacts table solved "columns feel cramped" with sticky columns and horizontal scroll — should the real fix have been letting users choose which columns they see, rather than making scrolling through all 18 more comfortable?
- If the icon-only sidebar was modeled on a reference CRM's rail, was that CRM's audience also doing all-day, 18-column data entry — or is a rail built for glanceable dashboards being reused where users need to recall seven icon meanings all day, every day?
- Soft-delete-with-confirmation is done correctly everywhere else — why does the Contact Overview form have no equivalent "are you sure" or even a Cancel button for an in-progress edit?
- Is the permanent notification dot a temporary stand-in awaiting real unread-counts, or a permanent decision? Those need very different follow-ups.
