# Architecture Lock - MVP

## Status
LOCKED for Phase awal MVP implementation.

## Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI language: Indonesian operational copy
Mobile priority: upload, review, prompt
Desktop priority: Flow Control and Google Flow handoff
Desktop sidebar: Dashboard, Produk, Prompt, Flow Control, Pengaturan
Mobile bottom nav: Dashboard, Produk, Prompt, Pengaturan
```

Shell rules:

- topbar may show route title and contextual actions only.
- topbar must not duplicate a Settings button.
- `Sign out` lives only in `Pengaturan > Account`.
- `/controller` is desktop-first; mobile direct access shows a minimal desktop-required state.
- no second navigation stack for settings.

## Route Policy

```text
/products       -> Produk list
/products/new   -> mobile-first intake workflow
/products/[id]  -> Metadata, Output, History
/prompts        -> Paket Prompt editor surface
/controller     -> desktop-only Flow Control board
/settings       -> Pengaturan hub
/intake         -> compatibility redirect to /products/new
/flow           -> compatibility redirect to /controller
/outputs        -> compatibility/archive view only
/gemini         -> primarily accessed from /settings
/drive          -> primarily accessed from /settings
```

`/controller` must not be exposed in mobile bottom nav. Direct mobile access should show a minimal desktop-required state.

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
- duplicate settings affordances in header, topbar, and sidebar.

## UI Baseline

The app should read as a neutral dark workbench, not a marketing site.

Locked presentation:

- compact spacing and dense information hierarchy.
- Graphite Gold workbench treatment is allowed: graphite surfaces, restrained champagne-gold accents, emerald operational status accents, and subtle depth.
- no oversized hero blocks on operational pages.
- 8px radius or less for cards and framed surfaces unless a local component rule requires otherwise.
- Geist Sans as the default type family.
- page title > section title > card title > label/body hierarchy.
- custom picker for relational fields, not raw dropdowns.
- static suggestions with free fallback only when the field is intentionally loose.
- every active surface must include loading, empty, and error states.
- mobile and desktop layouts must stay responsive without text overlap.
- desktop mutable master lists use searchable table + right side drawer.
- mobile mutable master lists use compact cards + full-screen drawer or bottom sheet.
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

Affiliate Profile is workspace-scoped and acts as the prompt persona. Character and environment locks are profile-owned only in Phase awal.

Prompt packs persist structured output and version history. Prompt pages may show active profile context but must not introduce per-prompt character/environment overrides.

The final lock keeps only character and environment as first-class profile assets. The environment asset carries the background-lock role.

## Execution

```text
Google Flow is external executor
Flow Control manages global Flow account pool
Flow accounts are global tools and never workspace-bound
Controller route: /controller
UI label: Flow Control
```

Account recommendation uses status, observed credit, and available slot. User confirms before execution.

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

- Workspace: list + drawer CRUD, auto-generated code, name, niche picker, Drive root picker, default switch, archive.
- Affiliate Profiles: list + drawer CRUD, base info, two asset cards, rule editors, archive.
- Gemini: single minimal form surface; no list/history UI.
- Drive: folder-centric list + drawer, workspace-scoped, folders only.
- Account: Chrome pairing, App API Token, and sign out.
- Flow Accounts are controller-owned execution tools and must not become a separate Settings CRUD surface.

## Deployment

Deployment target may be Vercel or equivalent. Secrets must stay server-side only.
