> **GROWTHOS** Design System — Precise Implementation Spec for Claude Code
# GrowthOS Design System

Every color, type size, spacing value, and component state specified exactly — no visual decision is left open. Companion to the PRD, App Flow Document, and Tech Stack Lockfile. Phase 1, light mode only.


## 1. Purpose & How to Use This Document

§9 contains copy-ready CSS custom properties in Tailwind v4's @theme format, matching the tailwindcss 4.3.3 / shadcn / Radix UI stack locked in the Tech Stack Lockfile. Everything in §3–§8 is the same information in explained, human-readable form — build from §9's tokens; use §3–§8 to understand what each token is _for_.

## 2. Brand Foundations


The wordmark reads **"Growth"** in dark navy and **"OS"** in bright cyan, with a coral upward-arrow swoosh beneath — the arrow is the one recurring brand motif (growth, momentum) and shouldn't be reused decoratively elsewhere in the product; it belongs to the logo.
**Logo usage rules:**
- **Clear space:** maintain a minimum margin around the logo equal to the height of the "O" in "Growth" on all four sides — no UI element, text, or edge of the viewport should sit closer than that.
- **Minimum size:** never render narrower than 96px wide (the wordmark becomes illegible at smaller sizes; use the icon-only sidebar treatment in §8.9 instead when space is tight).
- **Backgrounds:** the full-color logo (as supplied) is for white or near-white (neutral-50) backgrounds only — that's every surface in this light-mode-only Phase 1 product, so no alternate/reversed logo treatment is needed right now.
- **Don't:** stretch or distort the logo, recolor the wordmark, rotate it, add a drop shadow, or place it over a busy photo/background.
**Brand colors** (source of truth — full scales in §3):
| **Color** | **Hex** | **Role** |
| --- | --- | --- |
| Deep Navy | #022a66 | Darkest primary — headings, high-emphasis text |
| Navy | #113c7b | Primary — primary buttons, active/selected states, links |
| Cyan | #03b8de | Secondary/Interactive accent — highlights, chart accents, info |
| Coral Red | #ff5757 | Error/Danger + the logo's arrow accent |
| Yellow | #ffde00 | Warning |
| Green | #7ed957 | Success |


## 3. Color System

Every brand color below is expanded into an 11-step scale (50–950) so there's always an accessible option for text, fills, borders, and hover/active states. **Every scale step's contrast against pure white has been computed** (WCAG 2.1 relative luminance formula) — the "Safe for" column tells you exactly what that step may be used for. Never eyeball a lighter/darker variant; use the exact hex listed.

### 3.1 Primary (Navy)

| **Step** | **Hex** | **Contrast vs. white** | **Safe for** |
| --- | --- | --- | --- |
| 50 | #f5f7f9 | 1.07:1 | Backgrounds only (selected-row tint, subtle fills) |
| 100 | #e7ecf3 | 1.19:1 | Backgrounds only |
| 200 | #cbd8ec | 1.44:1 | Backgrounds, borders |
| 300 | #9fbbe5 | 1.96:1 | Borders, disabled-state fills |
| 400 | #6597e2 | 2.97:1 | Large UI elements/icons only (not text) |
| 500 | #2873e1 | 4.54:1 | **Text on white** (AA) |
| 600 | #1a5cbc | 6.36:1 | **Text on white** (AA) or **white text on this fill** (AA) |
| 700 | #113c7b | 10.74:1 | **Text on white** (AA) or **white text on this fill** (AA) — _exact brand navy, primary button default_ |
| 800 | #133972 | 11.32:1 | Text on white (AA) or white text on this fill (AA) — primary button hover |
| 900 | #022a66 | 13.76:1 | Text on white (AA) or white text on this fill (AA) — _exact brand navy, headings_ |
| 950 | #0a192e | 17.63:1 | Highest-emphasis text, primary button active/pressed |


### 3.2 Secondary / Info (Cyan)

| **Step** | **Hex** | **Contrast vs. white** | **Safe for** |
| --- | --- | --- | --- |
| 50 | #f5f9fa | 1.06:1 | Backgrounds only |
| 100 | #e5f2f5 | 1.14:1 | Backgrounds only |
| 200 | #c6e9f0 | 1.29:1 | Backgrounds, borders |
| 300 | #95dfee | 1.49:1 | Borders |
| 400 | #53d8f4 | 1.68:1 | Large decorative fills only |
| 500 | #03b8de | 2.36:1 | **Fills paired with dark text only** — _exact brand cyan; never as a background under white text_ |
| 600 | #03afd3 | 2.60:1 | Fills paired with dark text only |
| 700 | #028eab | 3.85:1 | Large text/icons only (AA-large, not small text) |
| 800 | #056a80 | 6.21:1 | **Text on white** (AA) or **white text on this fill** (AA) — use this step for a cyan button/link that must carry small text |
| 900 | #064856 | 10.15:1 | Text on white (AA) or white text on this fill |
| 950 | #052b33 | 15.00:1 | Highest-emphasis cyan text |


### 3.3 Success (Green)

| **Step** | **Hex** | **Contrast vs. white** | **Safe for** |
| --- | --- | --- | --- |
| 50–300 | #f7f9f6 – #b6dfa5 | < 1.5:1 | Backgrounds only (success banner/badge fill) |
| 400 | #7ed957 | 1.76:1 | **Fills paired with dark text only** — _exact brand green; badge background, success-state icons_ |
| 500 | #66d237 | 1.94:1 | Fills paired with dark text only |
| 600 | #50af28 | 2.80:1 | Large icons only |
| 700 | #418d20 | 4.15:1 | Large text/UI only (AA-large) |
| 800 | #326a1b | 6.54:1 | **Text on white** (AA) or **white text on this fill** (AA) — use for success text/buttons |
| 900–950 | #234814 / #162b0d | 10.46:1 / 15.16:1 | High-emphasis success text |


### 3.4 Warning (Yellow)

| **Step** | **Hex** | **Contrast vs. white** | **Safe for** |
| --- | --- | --- | --- |
| 50–300 | #faf9f5 – #f0e494 | < 1.3:1 | Backgrounds only |
| 400 | #ffde00 | 1.34:1 | **Fills paired with black text only** — _exact brand yellow; contrast vs. black is 15.70:1, excellent. Never pair with white text._ |
| 500–700 | #ffdf0a – #ad9700 | 1.33–2.92:1 | Fills paired with black text only |
| 800 | #817103 | 4.89:1 | **Text on white** (AA) — use when warning text (not a filled badge) is needed |
| 900–950 | #574d05 / #342e04 | 8.51:1 / 13.65:1 | High-emphasis warning text |


### 3.5 Error / Danger (Coral Red)

| **Step** | **Hex** | **Contrast vs. white** | **Safe for** |
| --- | --- | --- | --- |
| 50–300 | #faf5f5 – #f09494 | < 2.3:1 | Backgrounds only |
| 400 | #f65151 | 3.38:1 | Large UI elements/icons |
| 500 | #ff5757 | 3.11:1 | **Large text/UI only** (AA-large) — _exact brand coral; fine for icons, badge fills with dark text, large error banners, but not small error text_ |
| 600 | #d60000 | 5.44:1 | **Text on white** (AA) or **white text on this fill** (AA) — use this step for the "Delete"/destructive button and inline error text |
| 700–950 | #ad0000 – #340404 | 7.56:1–18.02:1 | Destructive-button hover/active states |


### 3.6 Neutral (Grayscale)

No brand gray was supplied, so neutrals use Tailwind's built-in **slate** scale directly — it's already cool-toned to complement the navy brand, ships with Tailwind v4, and needs no separate maintenance. Reference it as neutral-* throughout this document; §9 aliases it in code.
| **Step** | **Use** |
| --- | --- |
| 50 | Page background |
| 100 | Card/panel background (on top of the page background), table row hover |
| 200 | Borders (default), dividers |
| 300 | Borders (emphasized, e.g. input focus ring companion) |
| 400 | Disabled text, placeholder text |
| 500 | Secondary/muted body text |
| 600 | Default body text |
| 700 | Table headers, labels |
| 800 | Primary body text (headings usually use primary-900 instead) |
| 900–950 | Reserved — not used in Phase 1 (this light-mode UI never needs near-black beyond primary-900) |


### 3.7 Semantic Color Mapping

| **Purpose** | **Token** |
| --- | --- |
| Page background | neutral-50 |
| Card/surface background | #ffffff (pure white, to sit above neutral-50) |
| Primary action (buttons, active nav, links) | primary-700 |
| Primary action hover | primary-800 |
| Primary action active/pressed | primary-950 |
| Secondary/interactive accent (highlights, selected chips) | secondary-500 fill + primary-900 text, or secondary-800 where text-level contrast is required directly on the fill |
| Success state | success-400 fill / success-800 text |
| Warning state | warning-400 fill / black text |
| Error/destructive state | error-600 |
| Body text | neutral-800 |
| Secondary/muted text | neutral-500 |
| Disabled text | neutral-400 |
| Borders | neutral-200 (default), neutral-300 (emphasized) |
| Focus ring | secondary-500 at 40% opacity, 2px, per §7 |


## 4. Typography

**Typeface: Poppins** (Google Font, free — already licensed for web use, no font files to purchase). Load weights **400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)** only — no other weights are used anywhere in the product, so no others should be loaded (extra weights are pure page-weight cost).
```
--font-sans: "Poppins", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

**Base body size is 14px, not the usual 16px** — a deliberate choice for the compact/dense data views (§5.2): this matches the convention of HubSpot, Salesforce, and Linear, all of which run a 13–14px base for high-density UI.
| **Level** | **Size / Line-height** | **Weight** | **Use** |
| --- | --- | --- | --- |
| Display | 36px / 44px | 600 | Reserved, not used in Phase 1 (no marketing/landing surfaces in-app) |
| H1 | 28px / 36px | 600 | Page titles (e.g. "Contacts," "Opportunities") |
| H2 | 22px / 30px | 600 | Section headers within a page |
| H3 | 18px / 26px | 600 | Card/panel headers, modal titles |
| H4 | 16px / 24px | 600 | Sub-section labels, table group headers |
| Body Large | 16px / 24px | 400 | Onboarding wizard body copy, empty-state messaging |
| Body (default) | 14px / 20px | 400 | Default UI text, table cells, form inputs, most everything |
| Body Small | 13px / 18px | 400 | Secondary/help text, timestamps, activity-feed metadata |
| Caption / Label | 12px / 16px | 500 | Table column headers (uppercase, neutral-700), field labels, status-badge text |
| Button | 14px / 20px | 500 | All button labels |

Headings use primary-900 (#022a66); body and UI text use neutral-800/neutral-600/neutral-500 per §3.7. Never use a font weight below 400 or above 700; never use italics (Poppins' italic isn't loaded).

## 5. Spacing & Layout


### 5.1 Base Grid

**4px base unit**, using Tailwind's default spacing scale unmodified (1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 6 = 24px, 8 = 32px, 10 = 40px, 12 = 48px, 16 = 64px). No custom spacing tokens are needed — Tailwind's defaults are the spec.

### 5.2 Density

Data-heavy views (Contacts list, Opportunity table) are **compact**:
| **Element** | **Value** |
| --- | --- |
| Table row height | 40px |
| Table cell padding | 8px vertical, 12px horizontal |
| Table header height | 36px |
| List-item padding (Lists, Campaigns index) | 12px vertical, 16px horizontal |
| Card padding (Dashboard tiles, Opportunity kanban cards) | 16px |
| Form field vertical spacing | 16px between fields |
| Page content padding | 24px (32px on screens ≥ 1280px) |


### 5.3 Sidebar & Shell

| **Element** | **Value** |
| --- | --- |
| Sidebar width, expanded | 240px |
| Sidebar width, collapsed (icon-only) | 64px |
| Top bar height | 56px |
| CRO Leader "viewing as" banner height | 40px |
| Max content width (page body) | 1440px, centered, beyond that the layout doesn't stretch further — **except the fluid-width screens below** |

**Client-confirmed width strategy (approved mockup):** the 1440px cap stays the default for single-record and form screens (Contact Detail, Company/My Profile, Create/Edit Opportunity, Import Contacts, etc.) — reading comfort matters more than filling a wide monitor when the content is a form or a record. Table- and board-shaped screens instead go fluid up to **1800px** — Contacts (All Contacts + List Detail), Lists Index, Opportunities (Board and List view), and Users & Roles — since a wider viewport is exactly where "lots of columns feel cramped" was the original complaint driving this whole redesign pass.

### 5.4 Breakpoints

Tailwind defaults, unmodified: sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px. The sidebar collapses to icon-only **below ****lg**** (1024px)**, per the App Flow Document's automatic-collapse behavior — this is the one responsive breakpoint that matters in this desktop-first product.

## 6. Elevation, Radius & Borders


### 6.1 Border Radius

| **Token** | **Value** | **Use** |
| --- | --- | --- |
| radius-sm | 4px | Checkboxes, small badges |
| radius-md | 8px | Buttons, inputs, cards, kanban cards — **the default** |
| radius-lg | 12px | Modals, larger panels, dropdown menus |
| radius-full | 9999px | Pills/status badges, avatars |


### 6.2 Elevation (Shadow)

Use Tailwind's built-in shadow scale directly — no custom shadow values:
| **Token** | **Use** |
| --- | --- |
| shadow-sm | Cards and panels at rest (a subtle lift off the page background) |
| shadow-md | Dropdown menus, popovers, the date picker |
| shadow-lg | Modals/dialogs |
| shadow-xl | Toast notifications (they float above everything, including modals) |


### 6.3 Borders

Default border: **1px solid ****neutral-200**. Emphasized/focus-adjacent borders: **1px solid ****neutral-300**. Never use a border heavier than 1px except the focus ring (§7).

## 7. Focus, States & Accessibility

**Target: WCAG 2.1 Level AA** throughout — every text/background pairing specified in §3 already meets it; don't substitute an unlisted shade.
**Focus ring** (keyboard focus, every interactive element): 2px solid secondary-500 at 40% opacity, offset 2px from the element's edge. This applies uniformly to buttons, inputs, links, table rows, and kanban cards — one consistent focus treatment across the whole product.
**Interactive states**, defined once here and referenced by every component in §8:
| **State** | **Treatment** |
| --- | --- |
| Hover | Background/border shifts one step deeper on the relevant color scale (e.g. primary-700 → primary-800) |
| Active/pressed | Two steps deeper (e.g. primary-700 → primary-950) |
| Focus | The focus ring above, in addition to (not instead of) the hover treatment if focus and hover coincide |
| Disabled | 40% opacity on the whole element, cursor: not-allowed, no hover/active treatment applies |
| Loading | Content replaced by a centered spinner (§8.11) at the same dimensions, interaction disabled |


## 8. Component Specifications

Every screen in the App Flow Document is built from the components below. Where a component has variants, every variant is listed — don't invent one that isn't here.

### 8.1 Buttons

| **Variant** | **Background** | **Text** | **Border** | **Use** |
| --- | --- | --- | --- | --- |
| Primary | primary-700 (hover primary-800, active primary-950) | White | None | Main action on a screen (Save, Send, Create) |
| Secondary | White | primary-700 | 1px neutral-300 (hover primary-700) | Secondary action alongside a Primary button |
| Destructive | error-600 (hover error-700, active error-800) | White | None | Delete, remove, deactivate |
| Ghost | Transparent (hover neutral-100) | neutral-800 | None | Low-emphasis actions (e.g. "Cancel" in a modal) |
| Link | Transparent | primary-700 (underline on hover) | None | Inline text-level actions |

Sizes: **sm** (28px height, 12px horizontal padding), **md** (36px height, 16px horizontal padding — default), **lg** (44px height, 20px horizontal padding, used only for the Onboarding Wizard's primary CTA). Border radius radius-md on all sizes.

### 8.2 Form Fields

Text inputs, selects, textareas share one spec: 36px height (textarea: 3-line minimum height, resizable vertically only), radius-md, 1px neutral-300 border, neutral-50 background when disabled. States: default (border neutral-300), focus (border secondary-500 + focus ring per §7), error (border error-600, helper text below in error-600, Body Small), disabled (opacity 40%, cursor: not-allowed). Labels are Caption-level (§4), positioned above the field with 4px gap. Required fields get a error-600 asterisk after the label.

### 8.3 Badges / Status Pills

Used for prospect statuses (§6.2 of the PRD) and custom statuses. radius-full, Caption-level text, 4px vertical / 10px horizontal padding.
| **Status category** | **Fill** | **Text** |
| --- | --- | --- |
| Neutral (Suspect, Nurture) | neutral-100 | neutral-700 |
| In progress (Prospect, Contacted, Engaged, Appointment Scheduled) | secondary-50 (generated the same way as §3.2's lighter steps) | secondary-800 |
| Positive (Client Won) | success-50-equivalent light fill | success-800 |
| Negative (Lost, Ghosted) | error-50-equivalent light fill | error-700 |

Custom statuses an MSP creates default to the **Neutral** treatment above — Phase 1 does not let users pick a custom badge color (that's a real feature decision, not a styling gap; flagged in §10).

### 8.4 Opportunity Kanban Board

Per the confirmed direction: **cards stay neutral, only column headers carry color**, grouped into four semantic buckets rather than thirteen unique hues:
| **Stage group** | **Stages** | **Header color** |
| --- | --- | --- |
| Open/Active | Identified Interest, Discovery Scheduled, Discovery Completed, Solution Alignment, Proposal Development, Proposal Delivered, Negotiation, Verbal Commitment, Contract Sent | secondary-800 text on secondary-50-equivalent fill |
| Won | Closed Won | success-800 text on light success fill |
| Lost/Stalled | Closed Lost, Ghosted, On Hold | neutral-600 text on neutral-100 fill |

**Card:** white background, radius-md, shadow-sm at rest, shadow-md while dragging, 16px padding, 1px neutral-200 border. Contains: contact name (Body, neutral-800, weight 500), company name (Body Small, neutral-500), value (Body Small, neutral-700, right-aligned). Column width: 280px, fixed; the board scrolls horizontally per the App Flow Document.

**Client-confirmed modernization pass (approved mockup):** cards lift slightly on hover (-2px translate + shadow-md) so the board reads as interactive before a drag starts, matching the same hover-lift shadow-md they already got mid-drag. Column headers gained a pill-shaped count badge (white 70%-opacity fill, the stage's own text color, tabular-nums) in place of the old plain "12" appended after the name, and the drop target now also gets a thin secondary-200 inset ring in addition to the secondary-50 fill while a card is dragged over it.

### 8.5 Tables

Header row: neutral-50 background, Caption-level text in neutral-700, uppercase, 1px neutral-200 bottom border, sort-arrow icon (neutral-400, secondary-800 when the column is the active sort) right of the column label. Body rows: white background, neutral-100 on hover, secondary-50-equivalent fill when a row is selected (with a secondary-800 checkbox), 1px neutral-100 row divider. Row height and padding per §5.2 (48px as of the modernization pass below). No zebra-striping — the hover and selected states carry enough distinction at this density without it. On Users & Roles specifically, a user's own row (where the role isn't an editable Select, since you can't reassign your own role) now shows the role as an `info`-variant Badge pill rather than plain text, for visual consistency with the editable rows' dropdown.

**Client-confirmed exception — Contacts table only** (both the All Contacts view and a list's Detail page; a bespoke table, not the shared `Table` primitive below). Reviewed as mockups first ("Concept A — Navy Command Bar") before implementing:
- Header: solid primary-900 fill, white text, a small neutral-tone icon per column (matching what the column holds — a mail icon for Email, a building for Company, etc.), 16px vertical padding (up from the compact default) since 18 columns made the header feel cramped.
- Full Name and the row checkbox are pinned (`position: sticky`) to the left edge while the remaining columns scroll horizontally underneath — with this many columns, losing track of which row you're looking at was a real problem.
- Selected rows get both the secondary-50 tint *and* a 3px secondary-500 rail at the table's left edge (rendered on the pinned checkbox column, so it stays visible no matter how far right you've scrolled) — a plain background tint alone got lost against the wide row.
- Score renders as a number plus a small filled track (secondary-500 fill); Temp renders as an icon + colored word (error-600 for Hot, primary-500 for Cold) rather than a badge pill, to stay visually distinct from the Contact Status badge in the row next to it.

**Client-confirmed modernization pass, round two (approved mockup) — the shared `Table` component:** the navy-header language above was popular enough on its own that the client asked for it across the other primary data tables too, not just Contacts. `TableHeader`/`TableHead` now take an opt-in `variant="solid"` (primary-900 fill, white/90% text, no uppercase transform) and `SortableHeader` takes a matching `variant="solid"` so its icon/hover states stay legible on the dark fill — applied to Lists Index, Users & Roles, and the Opportunities List view. Tables that omit the prop (the Import Contacts preview/error tables) keep the original neutral-50 header untouched. Every `Table` instance also now sits inside a radius-lg neutral-200 card border, and row height moved from 40px to 48px to match the density this pass settled on elsewhere.

### 8.6 Tabs (Contact Detail)

Underline style, not pill style. Inactive tab: neutral-500 text. Active tab: primary-700 text, 2px primary-700 underline. Tab bar sits on a 1px neutral-200 bottom border spanning the full width. 16px horizontal padding per tab, 40px tab height.

### 8.7 Modals / Dialogs

radius-lg, shadow-lg, white background, max-width 480px (560px for the Import Contacts flow, which needs more room for the column-mapping step). Backdrop: primary-950 at 50% opacity. Header: H3-level title + a neutral-400 close icon (top-right, hover neutral-700). Footer: right-aligned button row, Ghost button (Cancel) then Primary or Destructive button, 12px gap between them. 24px padding throughout.

### 8.8 Toast Notifications

Bottom-right of viewport, radius-md, shadow-xl, 16px padding, 360px width. Success toast: success-400 left border accent (4px) + a success icon in success-800. Error toast: same pattern with error-600. Auto-dismiss after 5 seconds; the user can also dismiss manually via a close icon.

### 8.9 Sidebar Navigation

**Client-confirmed redesign:** the sidebar is now icon-only at every breakpoint (not just below `lg`) — labels are dropped in favor of a tooltip on hover, modeled on reference screenshots of another CRM's icon-rail navigation. Colors stay GrowthOS's own (this was explicitly not a full re-brand): background primary-900, icon at white 70% opacity (default), 100% opacity + primary-800 background pill (radius-md, inset 8px) when active/current section, 100% opacity with no background on hover. Disabled items (§2.4 of the App Flow Document): icon at 30% opacity, no hover treatment, cursor: not-allowed. Icons (lucide-react, §8.13) are 20px, centered, same opacity rules as before. Tooltip (§8.7-adjacent component, existing) shows the section label on hover/focus — this is now the only place the label appears, so the tooltip is load-bearing for accessibility, not decorative.

**Client-confirmed modernization pass (approved mockup):** the flat primary-900 fill became a top-to-bottom gradient (primary-800 → primary-950) plus a 1px translucent-white right edge, for a touch of depth against the white content area. The active item's filled pill also gained a 3px secondary-500 rail (rendered just left of the pill) — the same "this is selected" language the Contacts table and the Settings nav panels (below) now share, so "what's active" reads the same way everywhere in the shell.

**Settings navigation panels** — client-confirmed, modeled closely on the reference CRM's own drill-down depth rather than the flatter single-list version first tried. Docked columns rendered only while inside `/settings/*`, between the icon rail and the page content, replacing the old horizontal tab bar. Each column: white background, 224px wide, 1px neutral-200 right border, header in H4/primary-900. Item rows: 44px height, radius-md, inactive neutral-700 text on transparent with neutral-50 hover, active state secondary-50 background + primary-700 text (the same "selected" pairing already used for table rows, §8.5). Disabled rows (items with no corresponding GrowthOS page — client-confirmed to render as visible-but-inert rather than be omitted, matching the App Flow §2.4 disabled-nav philosophy already used elsewhere): neutral-300 text, cursor: not-allowed, no hover treatment.

**Client-confirmed modernization pass (approved mockup):** the active row's secondary-50/primary-700 pairing above also gained the same 3px secondary-500 left rail used by the Sidebar and the Contacts table, plus `font-medium`, so "this is the current page" reads identically across all three surfaces in the shell.

Three levels, not one:
- **Level A** (bare `/settings`): a single column, no "Go Back," two rows — *My Profile*, *Account Settings*.
- **Level B**: replaces Level A once one of those is chosen. *My Profile* → one column titled "My Profile" with a "Go Back" link (to Level A) and its own item rows (Contact Information and Password — both real, each its own page: `/settings/profile` and `/settings/profile/password` respectively, not sections of one scrollable page — interleaved with disabled rows: Email Signature, Two Factor Auth, Phone Numbers, Notifications, Integrations). WOLI AI Helper is omitted here entirely (client-confirmed removal, not just disabled) since it names a feature explicitly out of Phase 1 scope. *Account Settings* → one column titled "Account Settings" with "Go Back" (to Level A) and rows: Company, Billing & Payments (disabled), Email Auth, Users, Integrations (disabled), Customizations — the four real rows link to their pages.
- **Level C** (Account Settings branch only, shown as a second column alongside Level B, driven by whichever Level B row is active — no independent "Go Back" of its own): Users → Users & Roles (real) only; Email Auth → Connected Email Accounts (real) only; Customizations → Contact Statuses and Opportunity Stages (real) interleaved with disabled rows (Signature, Branding, Solutions, Company Types, Opportunity Types, Verticals, Categories, Custom Contact/Company/Opportunity Fields, Custom Insert Tags, Custom Activity Types) in the reference's own order. Company has **no** Level C (client-confirmed removal) — clicking "Company" in Level B goes straight to the Company Profile page, no second column.

The My Profile branch never grows a Level C — its Level B list already points straight at real content, unlike Account Settings' deeper nesting.

**Profile-style content card** — used by Company Profile and My Profile specifically (the two Settings screens that are a single record's fields, not a list/table). A gradient banner (primary-600 to secondary-500, 96px tall, radius-lg top corners) sits above the content card, with a circular avatar/logo (128px, white border, overlapping the banner's bottom edge by half its height — bumped up from an initial 64px per client feedback that it read as too small) and the record's name in white/Body-large to its right. Both circles are real uploads (ImageUploadCircle, shared behind CompanyLogoUpload and ProfileAvatarUpload): a small primary-700 camera-icon button sits at the circle's bottom-right corner, opening a file picker — PNG/JPG/WebP/SVG, 2MB max, uploaded to a public Supabase Storage bucket (`company-logos` or `avatars`) and written straight into `accounts.logo_url` / `users.avatar_url`. This is a client-confirmed reversal of the original "no file attachments in Phase 1" scope call, for these two fields specifically. Below the banner, a white card (radius-lg, 1px neutral-200 border) holds the remaining fields as icon-label-value rows (20px neutral-500 icon, Body-level neutral-800 label, value right-aligned or in a second column, 1px neutral-100 row divider) with an "Update Info" secondary-style button top-right of the card that toggles the row values into editable inputs in place, revealing Save/Cancel actions. List/table-shaped Settings screens (Users & Roles, Contact Statuses, Opportunity Stages, Connected Email Accounts) keep their existing table/list treatment; this card pattern is not force-fit onto them.

### 8.10 Top Bar & CRO Leader Banner

Top bar: white background, 1px neutral-200 bottom border, 56px height, logo left, search center-left, notification bell + user menu right. CRO Leader viewing-as banner (§2.5 of the App Flow Document): full-width, warning-400 background with black text (this is the one place warning-yellow is used outside a status badge — deliberately, since it needs to be impossible to miss), 40px height, company name left, "Exit to My Dashboard" ghost-style button right.

**Client-confirmed modernization pass (approved mockup):** the flat 1px bottom border became a layered shadow (a 1px neutral-200 line plus a soft 16px navy-tinted blur) for a touch more depth without a heavier border. The (still-disabled, pending Contacts search wiring) search field's bare bordered box became a borderless neutral-50 fill. The avatar menu trigger gained a transparent ring that turns secondary-100/secondary-500 on hover/focus, matching the teal "focus/active" language used throughout this pass.

**Impeccable critique finding (2026-09-06):** this pass briefly gave the notification bell a hardcoded "unread" dot with no real state behind it. Flagged as a persistently-lying status indicator (P2) and removed — the bell stays plain until a real unread-notifications source exists to drive it honestly.

### 8.11 Loading & Empty States

**Spinner** (per the confirmed direction, not skeleton screens): a circular spinner in primary-700, 24px for inline/button contexts, 40px centered in a content area for full-page loads.
**Empty states:** centered within the content area, a neutral-400 icon (relevant to the section — e.g. a person outline for Contacts) at 48px, Body-level neutral-500 message text below it ("No records yet" per the confirmed copy, or the email-connection nudge on Campaigns), 200px total vertical space minimum so the empty state doesn't look cramped.

### 8.12 Charts (Reports/Dashboard)

Recharts series colors, in order of use: primary-700, secondary-500, success-600, warning-600, error-500 — this order keeps the brand navy as the dominant/first series color while giving each additional series clear separation. Gridlines: neutral-100. Axis labels: Caption-level, neutral-500.

### 8.13 Iconography

**Library: ****lucide-react** (already pinned in the Tech Stack Lockfile). Stroke width **1.5px** everywhere (Lucide's default — don't override per-icon). Standard sizes: 16px (inline with Body Small/Caption text), 20px (sidebar nav, table row actions), 24px (empty states, section headers). Icon color always follows the surrounding text color (currentColor) except where a component spec above states otherwise (e.g. the sort-arrow and disabled-nav rules).

### 8.14 Auth Screens & the Opportunities View Toggle

**Client-confirmed modernization pass (approved mockup):** the login/forgot-password/reset-password/accept-invite layout's plain neutral background became a soft radial-gradient ground (secondary-800 glow upper-left, primary-700 glow lower-right, over a primary-950 base) with a deeper card shadow — cosmetic only, no change to the forms themselves. The Opportunities Board/List segmented toggle's flat `primary-700`-fill active state became a light neutral-50 track with a white, shadow-sm "pressed" pill for whichever view is active, consistent with how segmented controls read as a control rather than a badge.

**Impeccable critique finding (2026-09-06, P1) + fix:** this pass originally placed the logo directly on the gradient, above the white card — a direct violation of §2's "white/near-white backgrounds only" logo rule. Fixed by moving the logo inside the white card (above the form), which is spec-compliant with no new logo asset needed.

## 9. Copy-Ready Design Tokens

Tailwind v4 @theme block — drop directly into the project's global CSS file.
```
@theme {
  /* Primary (Navy) */
  --color-primary-50: #f5f7f9;
  --color-primary-100: #e7ecf3;
  --color-primary-200: #cbd8ec;
  --color-primary-300: #9fbbe5;
  --color-primary-400: #6597e2;
  --color-primary-500: #2873e1;
  --color-primary-600: #1a5cbc;
  --color-primary-700: #113c7b;
  --color-primary-800: #133972;
  --color-primary-900: #022a66;
  --color-primary-950: #0a192e;

  /* Secondary / Info (Cyan) */
  --color-secondary-50: #f5f9fa;
  --color-secondary-100: #e5f2f5;
  --color-secondary-200: #c6e9f0;
  --color-secondary-300: #95dfee;
  --color-secondary-400: #53d8f4;
  --color-secondary-500: #03b8de;
  --color-secondary-600: #03afd3;
  --color-secondary-700: #028eab;
  --color-secondary-800: #056a80;
  --color-secondary-900: #064856;
  --color-secondary-950: #052b33;

  /* Success (Green) */
  --color-success-50: #f7f9f6;
  --color-success-100: #ebf2e8;
  --color-success-200: #d6e9ce;
  --color-success-300: #b6dfa5;
  --color-success-400: #7ed957;
  --color-success-500: #66d237;
  --color-success-600: #50af28;
  --color-success-700: #418d20;
  --color-success-800: #326a1b;
  --color-success-900: #234814;
  --color-success-950: #162b0d;

  /* Warning (Yellow) */
  --color-warning-50: #faf9f5;
  --color-warning-100: #f5f3e5;
  --color-warning-200: #f1ebc6;
  --color-warning-300: #f0e494;
  --color-warning-400: #ffde00;
  --color-warning-500: #ffdf0a;
  --color-warning-600: #d6ba00;
  --color-warning-700: #ad9700;
  --color-warning-800: #817103;
  --color-warning-900: #574d05;
  --color-warning-950: #342e04;

  /* Error / Danger (Coral Red) */
  --color-error-50: #faf5f5;
  --color-error-100: #f5e5e5;
  --color-error-200: #f1c6c6;
  --color-error-300: #f09494;
  --color-error-400: #f65151;
  --color-error-500: #ff5757;
  --color-error-600: #d60000;
  --color-error-700: #ad0000;
  --color-error-800: #810303;
  --color-error-900: #570505;
  --color-error-950: #340404;

  /* Neutral — Tailwind's built-in slate scale, aliased for semantic use */
  --color-neutral-50: oklch(98.4% 0.003 247.858);
  --color-neutral-100: oklch(96.8% 0.007 247.896);
  --color-neutral-200: oklch(92.9% 0.013 255.508);
  --color-neutral-300: oklch(86.9% 0.022 252.894);
  --color-neutral-400: oklch(70.4% 0.04 256.788);
  --color-neutral-500: oklch(55.4% 0.046 257.417);
  --color-neutral-600: oklch(44.6% 0.043 257.281);
  --color-neutral-700: oklch(37.2% 0.044 257.287);
  --color-neutral-800: oklch(27.9% 0.041 260.031);
  --color-neutral-900: oklch(20.8% 0.042 265.755);
  --color-neutral-950: oklch(12.9% 0.042 264.695);

  /* Typography */
  --font-sans: "Poppins", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Layout */
  --sidebar-width-expanded: 15rem;
  --sidebar-width-collapsed: 4rem;
  --topbar-height: 3.5rem;
  --banner-height: 2.5rem;
}
```

Every value above was generated from the client's exact brand hex codes (§2) using the WCAG 2.1 relative-luminance contrast formula — not estimated. Do not regenerate or "improve" this scale; if a new brand color is ever introduced, extend it the same way (anchor the exact hex at its natural lightness step, interpolate the rest, verify contrast) rather than picking values by eye.

## 10. Open Items

- **Custom status colors (§8.3):** MSP-created custom statuses default to the neutral badge treatment. If you want MSPs to be able to pick a badge color when creating a custom status, that's a feature decision for the PRD, not a styling gap — flag it and this document will define the exact color-picker options (almost certainly a constrained set from §3's scales, not a free color picker, to keep the palette coherent).
- **Onboarding Wizard illustration/imagery style** isn't specified here — nothing in the PRD or App Flow Document calls for illustrations, so none are speced. If the wizard should feel more visual than the form-only treatment implied by §8.2, that's worth a follow-up.
