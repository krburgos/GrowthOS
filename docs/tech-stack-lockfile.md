> **GROWTHOS** Tech Stack Lockfile — Phase 1 Build Input for Claude Code
# GrowthOS Tech Stack Document

Every dependency pinned to an exact version, verified against the npm registry on August 28, 2026 · Phase 1 scope only · Companion to the PRD and App Flow Document


## 1. Purpose & Ground Rules

This document is a **build input for Claude Code** — not a narrative pitch. Every package below is pinned to the exact version published on npm as of the date above, so a fresh install produces the same dependency tree every time.
**Core platform** (given, not re-litigated here): **Next.js** (framework), **Supabase** (database + auth), **Vercel** (hosting), **Google Gemini API** (AI — reserved for a later phase, see §6). **Package manager: npm** — ships with Node.js, no version-manager setup required, the safest default for Claude Code and CI.
**Scope:** Phase 1 only, matching the PRD and App Flow Document — the CRM, contacts/opportunities/lists/campaigns, email sending and tracking, reporting, and the CRO Leader admin view. Nothing here pins dependencies for the AI recommendation engine, CallForce, AdvocateDash, or LinkedIn integration — those get their own version check when their phase actually starts, because pinning today's versions for code that won't be written for months guarantees they'll be stale by then.

## 2. Runtime Target

| **Setting** | **Value** |
| --- | --- |
| Node.js | **24.x** — Vercel's current default LTS for Functions (Node 20 is deprecated on Vercel October 1, 2026; Node 24 is the supported, actively-maintained line as of this document's date) |
| Package manager | npm (version bundled with Node 24.x — no separate pin needed) |
| package.json engines field | "node": "24.x" |


## 3. Locked Dependency Reference


### 3.1 Framework & Language

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| next | **16.3.3** | App Router |
| react | **19.2.8** |  |
| react-dom | **19.2.8** | Matches the react version exactly |
| typescript | **5.9.3** | Not the npm latest tag — see §5.1 for why |
| @types/node | **24.10.0** | Matches the Node 24.x runtime target |
| @types/react | **19.2.18** | Matches the react version |
| @types/react-dom | **19.2.4** | Matches the react-dom version |


### 3.2 Styling & UI Components

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| tailwindcss | **4.3.3** | Utility-first CSS engine |
| @tailwindcss/postcss | **4.3.3** | Tailwind v4's PostCSS plugin, required for the Next.js build pipeline |
| shadcn (CLI) | **4.19.0** | Dev-time scaffolding tool, run via npx — not a runtime dependency itself, but pin the CLI version so every component it generates is consistent. See §5.4 |
| class-variance-authority | **0.7.1** | Variant styling, a shadcn/ui dependency |
| clsx | **2.1.1** | Class-name merging |
| tailwind-merge | **3.6.0** | Resolves conflicting Tailwind classes |
| lucide-react | **1.34.0** | Icon set, the shadcn/ui default |
| sonner | **2.0.8** | Toast notifications — the shadcn/ui-recommended replacement for Radix's own toast primitive |
| react-day-picker | **10.0.1** | Date picker (pairs with date-fns, §3.6) |

**Radix UI primitives** — added incrementally as each shadcn/ui component is scaffolded; pin these when first added, matching what the component actually needs:
| **Package** | **Version** |
| --- | --- |
| @radix-ui/react-dialog | **1.1.23** |
| @radix-ui/react-dropdown-menu | **2.1.24** |
| @radix-ui/react-select | **2.3.7** |
| @radix-ui/react-tabs | **1.1.21** |
| @radix-ui/react-popover | **1.1.23** |
| @radix-ui/react-avatar | **1.2.6** |
| @radix-ui/react-checkbox | **1.3.11** |
| @radix-ui/react-label | **2.1.15** |
| @radix-ui/react-separator | **1.1.15** |
| @radix-ui/react-tooltip | **1.2.16** |

This set covers the screens in the App Flow Document — tabs (contact detail), dropdown menu (user/account menu), dialog (confirmation modals), select (list/table filters), popover + the date picker (campaign scheduling), avatar (user menu), checkbox (bulk row selection), tooltip, and separators. If a screen turns out to need a Radix primitive not listed here, pin whatever version is current on npm at the time it's added — don't guess ahead.

### 3.3 Data & Auth

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| @supabase/supabase-js | **2.107.0** | Client and server data access |
| @supabase/ssr | **0.10.3** | Server-side auth/session handling for Next.js App Router |


### 3.4 Forms & Validation

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| react-hook-form | **7.86.0** | Form state and submission handling |
| zod | **4.4.3** | Schema validation, shared between client-side form checks and server-side input validation |
| @hookform/resolvers | **5.9.1** | Wires Zod schemas into React Hook Form |


### 3.5 Data Fetching, Tables & Drag-and-Drop

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| @tanstack/react-query | **5.101.0** | Client-side data fetching/caching, including optimistic updates for the Opportunity board drag actions |
| @tanstack/react-table | **8.21.3** | Sortable/filterable Contacts and Opportunity list views |
| @dnd-kit/core | **6.3.1** | Opportunity kanban board — draggable cards between stage columns |
| @dnd-kit/sortable | **10.0.0** | Sortable-list behavior on top of @dnd-kit/core |
| @dnd-kit/utilities | **3.2.2** | Shared helpers used by the @dnd-kit packages |


### 3.6 Dates & Charts

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| date-fns | **4.4.0** | Date formatting/manipulation, pairs with react-day-picker |
| recharts | **3.10.1** | Reports/Dashboard KPI charts, per your direction to include real charts rather than stat tiles alone |


### 3.7 Import/Export (Spreadsheet handling)

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| papaparse | **5.6.0** | CSV import (§6.1 of the PRD) and CSV report export |
| @types/papaparse | **5.5.2** | Type definitions for papaparse |
| exceljs | **4.4.0** | XLSX import and export — chosen over the xlsx/SheetJS npm package, whose npm-published build lags its official releases and carries known licensing friction; ExcelJS is MIT-licensed and cleanly distributed |


### 3.8 Email Sending

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| nodemailer | **9.0.5** | Sends via SMTP — see §5.2 for why this instead of a vendor-specific SDK |
| @types/nodemailer | **8.0.1** | Type definitions for nodemailer |

**Delivery vendor: SendGrid**, used as an SMTP relay (no separate SendGrid npm package needed — credentials go through environment variables, §7). SendGrid's own dashboard and Event Webhook provide the open/click/bounce/unsubscribe tracking data the PRD and App Flow Document require.

### 3.9 Dev Tooling (minimal, per your direction)

| **Package** | **Version** | **Notes** |
| --- | --- | --- |
| eslint | **10.9.1** | Linting |
| eslint-config-next | **16.3.3** | Matches the Next.js version exactly |
| prettier | **3.9.6** | Formatting |

No testing framework is pinned in this pass, per your call to stay scoped to what ships Phase 1 within the timeline. Add one (Vitest is the natural fit alongside this stack) whenever that changes.

## 4. Consolidated package.json Fragment

Ready to drop into a fresh create-next-app scaffold — Claude Code should reconcile this against whatever the scaffold generates rather than assuming a blank slate.
```
{
  "engines": {
    "node": "24.x"
  },
  "dependencies": {
    "next": "16.3.3",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "@supabase/supabase-js": "2.107.0",
    "@supabase/ssr": "0.10.3",
    "react-hook-form": "7.86.0",
    "zod": "4.4.3",
    "@hookform/resolvers": "5.9.1",
    "@tanstack/react-query": "5.101.0",
    "@tanstack/react-table": "8.21.3",
    "@dnd-kit/core": "6.3.1",
    "@dnd-kit/sortable": "10.0.0",
    "@dnd-kit/utilities": "3.2.2",
    "date-fns": "4.4.0",
    "recharts": "3.10.1",
    "papaparse": "5.6.0",
    "exceljs": "4.4.0",
    "nodemailer": "9.0.5",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.6.0",
    "lucide-react": "1.34.0",
    "sonner": "2.0.8",
    "react-day-picker": "10.0.1",
    "@radix-ui/react-dialog": "1.1.23",
    "@radix-ui/react-dropdown-menu": "2.1.24",
    "@radix-ui/react-select": "2.3.7",
    "@radix-ui/react-tabs": "1.1.21",
    "@radix-ui/react-popover": "1.1.23",
    "@radix-ui/react-avatar": "1.2.6",
    "@radix-ui/react-checkbox": "1.3.11",
    "@radix-ui/react-label": "2.1.15",
    "@radix-ui/react-separator": "1.1.15",
    "@radix-ui/react-tooltip": "1.2.16"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/node": "24.10.0",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "@types/papaparse": "5.5.2",
    "@types/nodemailer": "8.0.1",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "eslint": "10.9.1",
    "eslint-config-next": "16.3.3",
    "prettier": "3.9.6"
  }
}
```

The shadcn CLI (**4.19.0**) is not listed here — it's invoked with npx shadcn@4.19.0 ... at scaffold time rather than installed as a project dependency; it's what adds each Radix primitive above to dependencies as components are generated.

## 5. Key Decisions & Rationale


### 5.1 TypeScript: 5.9.3, not the npm latest tag (7.0.2)

TypeScript 7.0 — the Go-native compiler rewrite — reached general availability in August 2026, days before this document. It's faster, but it is by definition less than a year old and the surrounding tooling (ESLint plugins, editor integrations, framework-specific type-checking) is still catching up. TypeScript 5.9.3 is the mature, JS-based line with years of ecosystem support behind it — the well-established alternative the selection rule calls for. Revisit this once TS 7 has a track record; it isn't a permanent no.

### 5.2 Email: Nodemailer + SendGrid SMTP, not a vendor SDK or AWS SES

Two things were weighed: cost (Amazon SES is cheapest at real volume) versus setup simplicity (avoiding a fourth vendor account/IAM relationship alongside Vercel, Supabase, and whatever handles email). Given the one-month timeline and "very limited, tools only" budget, simplicity won — SendGrid needs only an API key/SMTP credential and has a workable free tier to start, with no AWS account, domain verification through IAM, or sending-limit request process to go through first.
For the library itself: SendGrid's own @sendgrid/mail package is an official vendor SDK, but it's a thin wrapper with a much smaller GitHub following than the job calls for. **Nodemailer** (17k+ GitHub stars, in production use for over a decade) sends over plain SMTP to any provider — including SendGrid's SMTP relay — so it satisfies the star/age rule cleanly while keeping the door open to switch providers later without touching the sending code, only the SMTP credentials.

### 5.3 No rich-text editor for campaign emails

Per your direction, campaign composition (App Flow §4.7) uses a plain-text/basic-formatting template with merge fields rather than a WYSIWYG editor — so no editor library (Tiptap or similar) is in this document. Add one if that changes; it's a self-contained addition that doesn't ripple through the rest of the stack.

### 5.4 shadcn/ui is a methodology, not a pinned dependency

shadcn/ui doesn't install as a package — its CLI copies component source directly into the repo, built on Radix UI primitives and Tailwind. What's actually pinned is the CLI version used to generate that source (so every component comes from the same generation) and the Radix primitive packages it adds along the way (§3.2).

### 5.5 Google Gemini — deliberately not installed yet

Confirmed with you: Gemini isn't used by any Phase 1 feature. See §6.

## 6. Reserved for Later Phases

Not part of the Phase 1 build — recorded here only so Claude Code doesn't reach for the wrong package name when the AI recommendation engine phase starts.

## 7. Environment Variables Checklist

Values Claude Code will need supplied (not generated) before the app can run end to end:
| **Variable** | **Purpose** |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous/public key |
| SUPABASE_SERVICE_ROLE_KEY | Server-side Supabase operations (never exposed to the client) |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD | SendGrid SMTP relay credentials, used by Nodemailer |
| EMAIL_FROM_ADDRESS | Default sending address for campaigns and system email |
| GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET | Google Workspace email account connection (PRD §9) |
| MICROSOFT_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_SECRET | Microsoft 365 email account connection (PRD §9) |

GEMINI_API_KEY is intentionally not listed — it isn't needed until the phase in §6 begins.

## 8. Notes for Claude Code

- Install exact versions as pinned — don't let npm install resolve to a newer caret/tilde range unless a specific package is later revisited and re-pinned deliberately.
- If create-next-app scaffolds a different starting version of Next.js/React/TypeScript than pinned here, reconcile down (or up) to match this document rather than keeping whatever the scaffold defaulted to.
- Radix primitives (§3.2) are added as their corresponding shadcn/ui component is generated — don't install the full set upfront if a screen doesn't need it yet.
- Every version in this document was verified directly against the npm registry on August 28, 2026 — if a build happens meaningfully later than that, it's worth spot-checking the fast-moving entries (Next.js, Tailwind, Supabase clients, TanStack packages) before trusting them unchanged.
