# Architecture Lock - MVP

## Status
Phase 1 Mobile PWA Pivot is `PASS` and remains the locked baseline architecture.

Current active work is Phase 2 micro-task implementation under `docs/PHASE_2_ARCHITECTURE_LOCK.md`.

Visual override: the Visual PWA Mobile-First references approved on 2026-05-04 override older shell and UI baseline decisions when they conflict.

## Phase Status

```text
Phase 1 MVP Baseline: PASS
Current Active Phase: Phase 2 Micro-Task Implementation
Phase 2 Lock Status: LOCKED FOR MICRO-TASK IMPLEMENTATION
```

Phase 2 implementation must preserve this architecture unless a later source-of-truth lock explicitly changes it. The Phase 2 lock does not unfreeze mobile Flow surfaces, browser automation, large asset storage rules, secret handling, or the single-owner model.

## Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI language: Indonesian operational copy
Mobile priority: intake, review, prompt, Drive visual management
Shell nav: Dashboard, Intake, Produk, Prompt, Drive
Phase 1 entrypoint: /products/new
Dashboard: secondary analytics route
Controller/Flow: Dormant/Frozen, backend retained
```

Shell rules:

- topbar global controls are Notifications and the Profile avatar menu.
- the Profile avatar opens the profile overview and includes menu actions for `Pengaturan` and `Sign out`.
- `/settings` must render no duplicate standalone Settings gear/action.
- Settings remains the locked `/settings` route and must not be added to bottom navigation.
- workspace picker must not be shown in the global shell.
- `Sign out` is allowed from the Profile avatar menu and `Pengaturan > Account`.
- mobile app shell uses fixed bottom navigation for Dashboard, Intake, Produk, Prompt, and Drive.
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

`/controller` must not be exposed in shell navigation during Phase 1. Existing backend Controller/Flow logic must not be deleted by the freeze unless a future task explicitly approves removal.

`/settings` is the configuration hub and overview-only surface. Section work must live in locked nested settings routes, not in one long flat settings page. The app must not create a second global settings navigation.

Locked settings routes:

```text
/settings/workspace
/settings/affiliate-profiles
/settings/gemini
/settings/account
/settings/drive -> compatibility redirect to /settings
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
- duplicate standalone Settings affordances in header, topbar, sidebar, or bottom nav. Settings is allowed only as a Profile avatar menu action and through the locked `/settings` route.

## UI Baseline

The app should read as a light native mobile workbench, not a marketing site.

Locked presentation:

- Visual PWA Mobile-First references from 2026-05-04 are the active UI baseline.
- compact spacing and dense information hierarchy.
- Inter is the default type family.
- non-badge UI color is neutral black/white/grayscale through shared tokens; primary actions must not use blue or gradient backgrounds.
- semantic status badge colors remain allowed for badges only.
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
- Drive visual manager uses a touch-friendly hierarchical browser with Grid/List modes, not a flat all-items table.
- Drive file preview opens in a bottom sheet on mobile with preview, metadata, status, path, and Open link action; desktop may use the isolated right-side preview drawer.
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
Image-like Drive items may resolve server-side into transient preview data URLs for product thumbnails and Drive previews. This is render-time presentation only and does not create a new asset store.
Drive Phase 1 UI: hierarchical browser over Drive item metadata with Grid/List modes
```

Google Drive stores real uploaded product images, marketplace screenshots, prompt references, raw clips, final clips, batch manifests, and upload package assets.

Google Drive folder setup is static and automatic for the MVP. The app provisions the fixed `/AffiliateAI/` folder tree server-side when a connected Drive account is available; operators do not paste or pick Drive root folder links during normal setup.

2026-05-07 Intake lifecycle lock: product capture and metadata analysis are separate. Intake may save a `DRAFT` product with the product image first, then run Gemini metadata analysis after at least one Shopee or TikTok screenshot evidence is complete. Metadata readiness must not be inferred from `products.status`, and Gemini failure must keep the saved product recoverable.

## AI

```text
Gemini API via encrypted API key registry
Live Gemini analysis required for real E2E acceptance
Mock mode allowed only as labeled development fallback
Prompt rules editable in Affiliate Profile UI
Structured JSON outputs required
Usage overview derived from app-recorded Gemini usage events
```

Gemini may analyze image bytes uploaded by the operator. The app must not claim visual parsing from links when image bytes are unavailable.

Active Gemini keys require project metadata so usage can group by `project + model` instead of typing quota values manually.

Gemini request usage is tracked server-side after a key is selected. The overview counts `RPD` by Google quota day at midnight Pacific, `RPM` by rolling 60 seconds, and `TPM` from Gemini `usageMetadata.promptTokenCount`. Quota display groups by `project + model` when project metadata exists and falls back to per-key grouping only when project is empty.

## Prompt Personalization

Affiliate Profile is the visible top-level namespace and prompt persona for the private operator workflow. Each Affiliate Profile owns exactly one internal workspace/folder namespace during the 2026-05-06 refactor. Workspace remains internal storage/scope infrastructure and must not be expanded as a user-facing planning model.

Prompt packs persist structured output and version history. Prompt pages may show active profile context but must not introduce per-prompt character/environment overrides. If an active profile lock is enabled but the Drive reference or cached analysis JSON is missing, generation must block.

The final lock keeps only character and environment as first-class profile assets. The environment asset carries the background-lock role.

Implementation guard:

- do not add global workspace picker UI.
- do not expose many-to-many workspace profile choices in Affiliate Profile forms.
- do not add new UI copy beyond approved labels or already existing app copy.
- do not remove the `workspaces` schema until a later dedicated schema cleanup task is approved.

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

Phase 2 implementation order now lives in `docs/PHASE_2_ARCHITECTURE_LOCK.md`. The retained Flow/Controller backend remains governed by this architecture, `docs/FLOW_BATCH_BRIDGE_LOCK.md`, and `docs/FLOW_HELPER_DESKTOP_WORKFLOW.md`.

## Windows Helper

Windows Helper is a local companion for desktop execution.

In scope:

- app downloads or exposes batch manifest JSON.
- helper reads/imports the manifest.
- helper maps `flow_account_code` and app-visible `chrome_profile_lane_key` labels to a local Chrome profile path from local config.
- helper opens the correct Chrome profile and Google Flow URL.
- helper watches a local output folder configured locally.
- helper renames output files using the manifest.
- helper uploads output files directly to Google Drive with local OAuth.
- helper posts metadata callback to the app using App API Token.
- Supabase may store lane key labels for operator visibility, but never absolute Chrome profile paths.
- The app-visible pairing state is derived from helper verification; the app must not claim a Flow account is paired until the helper confirms lane availability.
- Lane states are `Not paired`, `Lane key set`, `Helper verified`, `Session expired`, or `Unavailable`.

Out of scope:

- auto-clicking Google Flow.
- selecting Google Flow projects automatically.
- submitting prompts to Google Flow automatically.
- storing Chrome profile paths in Supabase.
- storing helper Google Drive OAuth tokens in Supabase.

## Settings

Pengaturan is the configuration hub for:

- Akun Affiliate.
- Gemini.
- Google Drive.
- Flow link/status.
- Windows Helper / App API Token.
- Account/logout.

Settings detail grammar:

- Workspace: retained internal support only during the refactor; new feature work must not expand Workspace UX.
- Affiliate Profiles: list + drawer CRUD, base info, two asset cards, visible `Lock Character` and `Lock Environment` controls, rule editors, archive, and one internal workspace/folder namespace per profile.
- Settings overview owns the active Affiliate Profile switch. Activating a profile also activates its internal workspace namespace.
- Gemini: multi-key list + drawer CRUD; no request history UI. Editable fields are name, project, model, purpose, and masked encrypted key. Quota limits are auto-filled from the selected model and are not typed by the operator.
- Settings overview may show a compact Gemini usage panel directly above the card groups.
- Google Drive connect/status lives in the Connected Services overview row; `/settings/drive` is a compatibility redirect only.
- Drive folder provisioning is automatic under `/AffiliateAI/`; Workspace settings must not expose manual Drive root URL/path/ref setup.
- Drive primary route: hierarchical Grid/List browser rooted at the active Affiliate Account workspace folder, with mobile bottom-sheet preview and desktop right-side drawer preview.
- Account: Chrome pairing labels, App API Token, and sign out. Sign out is also allowed from the Profile avatar menu.
- Flow Accounts are controller-owned execution tools for Phase 2 and must not become a separate Settings CRUD surface.

## Deployment

Deployment target may be Vercel or equivalent. Secrets must stay server-side only.
