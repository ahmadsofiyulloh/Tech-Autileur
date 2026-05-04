# Architecture Lock - MVP

## Status
LOCKED for Phase 1 Mobile PWA Pivot implementation.

Visual override: the Visual PWA Mobile-First references approved on 2026-05-04 override older shell and UI baseline decisions when they conflict.

## Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI language: Indonesian operational copy
Mobile priority: intake, review, prompt, Drive visual management
Primary nav: Intake, Produk, Prompt, Drive
Phase 1 entrypoint: /products/new
Dashboard: secondary analytics route
Controller/Flow: Dormant/Frozen, backend retained
```

Shell rules:

- topbar right action is a Settings gear on every non-Settings route.
- `/settings` must render no right-side topbar action.
- the Settings gear is the only global Settings entry point and is not a duplicate navigation stack.
- workspace picker must not be shown in the global shell.
- `Sign out` lives only in `Pengaturan > Account`.
- mobile app shell uses fixed bottom navigation for Intake, Produk, Prompt, and Drive.
- bottom navigation must use safe-area padding and stay above page content.
- bottom sheets must use safe-area padding and render above bottom navigation.
- `/controller` and `/flow` direct access redirect to `/products/new` during Phase 1.
- no second navigation stack for settings.
- Phase 1 PWA scope is manifest and meta tags only; no service worker or offline cache engine.

## Route Policy

```text
/               -> /products/new
/products       -> Produk list
/products/new   -> mobile-first intake workflow
/products/[id]  -> Metadata, Output, History
/prompts        -> Paket Prompt editor surface
/drive          -> visual Drive manager
/dashboard      -> secondary analytics route
/settings       -> Pengaturan hub
/intake         -> compatibility redirect to /products/new
/controller     -> frozen route redirect to /products/new
/flow           -> frozen route redirect to /products/new
/outputs        -> compatibility/archive view only
/gemini         -> primarily accessed from /settings
```

`/controller` must not be exposed in primary navigation during Phase 1. Existing backend Controller/Flow logic must not be deleted by the freeze unless a future task explicitly approves removal.

`/settings` is the configuration hub and overview-only surface. Section work must live in locked nested settings routes, not in one long flat settings page. The app must not create a second global settings navigation.

Locked settings routes:

```text
/settings/workspace
/settings/affiliate-profiles
/settings/gemini
/settings/drive
/settings/account
```

## UI Copy Policy

Allowed:

- page title.
- section title.
- field label.
- action label.
- status label.
- one-sentence empty state.
- one-sentence error state.
- overview page summary, only on hub/landing surfaces.

Forbidden:

- verbose page descriptions.
- repeated explanatory paragraphs.
- marketing language.
- hardcoded prompt guidance in UI copy.
- multiple simultaneous Settings affordances in header, topbar, sidebar, or bottom nav. The approved topbar gear on non-Settings routes is allowed.

## UI Baseline

The app should read as a light native mobile workbench, not a marketing site.

Locked presentation:

- Visual PWA Mobile-First references from 2026-05-04 are the active UI baseline.
- compact spacing and dense information hierarchy.
- Inter is the default type family.
- primary action color is `#007AFF`.
- surface tokens cover topbar, bottom nav, base page, borders, and inactive components.
- semantic tokens cover success, warning, error, and info states.
- typography and color for any new or edited UI must come from shared semantic tokens, not hardcoded literals in component code.
- if a component needs a new visual value, extend the token layer first and keep the raw value only in the token source-of-truth block.
- no oversized hero blocks on operational pages.
- 8px radius or less for cards and framed surfaces unless a local component rule requires otherwise.
- page title > section title > card title > label/body hierarchy.
- shared custom picker for choice fields, not raw dropdowns.
- static suggestions with free fallback only when the field is intentionally loose.
- every active surface must include loading, empty, and error states.
- mobile and desktop layouts must stay responsive without text overlap.
- desktop mutable master lists use searchable table + right side drawer.
- mobile mutable master lists use compact cards + full-screen drawer or bottom sheet.
- mobile primary surfaces must avoid dense data tables.
- Drive visual manager uses a touch-friendly grid/gallery, not a table.
- Drive preview opens in a bottom sheet with preview, metadata, status, path, and Open link action.
- Phase 1 gestures are limited to pull-to-refresh indicator, bottom-sheet dismiss, and Drive long-press select.
- every gesture must have a tap/click fallback.
- cards are for individual repeated items, modals, and framed tools only; do not put UI cards inside other UI cards.
- create entrypoints appear only in page header and empty state CTA.
- row actions are `Open` plus edit/archive/delete in overflow.
- archive-first lifecycle is the default; hard delete is exceptional.

## Auth

```text
Provider: Supabase Auth
User model: single owner/operator
Team/role permission: out of scope MVP
```

## Database

```text
Database: Supabase Postgres
Metadata source of truth: Supabase database
RLS: enabled on all owner-owned tables
All owner-owned tables: include user_id unless explicitly documented as static reference
```

## Storage

```text
Asset/file source of truth: Google Drive
Supabase Storage: not used for large video/image assets in MVP
Intake image UX: upload cards with local preview, not link-only parsing
Supabase stores: Drive item metadata, URL, path, MIME type, status, relationships
Drive Phase 1 UI: visual grid over all Drive item metadata
```

Google Drive stores real uploaded product images, marketplace screenshots, prompt references, raw clips, final clips, batch manifests, and upload package assets.

## AI

```text
Gemini API via encrypted API key registry
Live Gemini analysis required for real E2E acceptance
Mock mode allowed only as labeled development fallback
Prompt rules editable in Affiliate Profile UI
Structured JSON outputs required
```

Gemini may analyze image bytes uploaded by the operator. The app must not claim visual parsing from links when image bytes are unavailable.

## Prompt Personalization

Affiliate Profile is a top-level prompt persona. Workspace links are explicit and can mark one default per workspace. Character and environment locks are profile-owned only in Phase awal.

Prompt packs persist structured output and version history. Prompt pages may show active profile context but must not introduce per-prompt character/environment overrides. If a selected profile lock is enabled but the Drive reference is missing, generation must block.

The final lock keeps only character and environment as first-class profile assets. The environment asset carries the background-lock role.

## Execution

```text
Google Flow is external executor
Flow Control manages global Flow account pool
Flow accounts are global tools and never workspace-bound
Controller route: /controller
UI label: Flow Control
Phase 1 state: Dormant/Frozen
```

Account recommendation uses status, observed credit, and available slot. User confirms before execution when Flow returns in Phase 2.

During Phase 1, Controller and Flow orchestration are hidden from primary UI and direct route access redirects to `/products/new`. Do not build a complex visual flow builder, drag-and-drop node editor, or mobile Flow queue manager.

## Windows Helper

Windows Helper is a local companion for desktop execution.

In scope:

- app downloads or exposes batch manifest JSON.
- helper reads/imports the manifest.
- helper maps `flow_account_code` to a local Chrome profile path from local config.
- helper opens the correct Chrome profile and Google Flow URL.
- helper watches a local output folder configured locally.
- helper renames output files using the manifest.
- helper uploads output files directly to Google Drive with local OAuth.
- helper posts metadata callback to the app using App API Token.

Out of scope:

- auto-clicking Google Flow.
- selecting Google Flow projects automatically.
- submitting prompts to Google Flow automatically.
- storing Chrome profile paths in Supabase.
- storing helper Google Drive OAuth tokens in Supabase.

## Settings

Pengaturan is the configuration hub for:

- Ruang Kerja.
- Akun Affiliate.
- Gemini.
- Google Drive.
- Flow link/status.
- Windows Helper / App API Token.
- Account/logout.

Settings detail grammar:

- Workspace: list + drawer CRUD, hidden auto-generated code, name, niche picker, Drive root picker, default switch, archive.
- Affiliate Profiles: list + drawer CRUD, base info, two asset cards, rule editors, archive, and explicit workspace links/default selection.
- Gemini: single minimal form surface; no list/history UI.
- Drive settings: folder-centric list + drawer, workspace-scoped, folders only.
- Drive primary route: visual all-items grid/gallery with bottom-sheet preview.
- Account: Chrome pairing, App API Token, and sign out.
- Flow Accounts are controller-owned execution tools for Phase 2 and must not become a separate Settings CRUD surface.

## Deployment

Deployment target may be Vercel or equivalent. Secrets must stay server-side only.
