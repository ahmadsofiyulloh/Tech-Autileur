# PRD v1 Final - Affiliate AI Content OS MVP

**Status:** LOCKED FOR MVP IMPLEMENTATION
**Version:** 1.3 Phase 1 Visual PWA Override Lock
**Date:** 2026-05-04
**Primary Operator:** Single owner/operator
**Implementation Target:** Next.js PWA + Supabase + Google Drive + Gemini API + Google Flow workflow + Windows Helper
**Implementation Mode:** Codex CLI with strict source-of-truth docs and Git checkpoints
**Visual Override:** The Visual PWA Mobile-First references approved on 2026-05-04 override older shell and UI baseline decisions when they conflict.

## 0. Executive Summary

Affiliate AI Content OS is a private operator tool for AI affiliate content production. Phase 1 prioritizes a mobile-first PWA loop for product screenshot intake, Gemini Vision metadata extraction, affiliate-profile prompt personalization, and visual Google Drive asset management.

This MVP is an AI production control center. It is not a video editor, not an auto-uploader to TikTok/Shopee, and not a browser automation system.

Phase 1 freezes Controller and Flow orchestration as primary UI surfaces. Existing backend logic may remain for later reuse, but the operator-facing Phase 1 experience must focus on Intake, Produk, Prompt, and Drive.

## 1. Locked App Flow and UX

### 1.1 Main Navigation

Primary Phase 1 navigation labels are exactly:

```text
Intake
Produk
Prompt
Drive
```

Mobile bottom navigation labels are exactly:

```text
Intake
Produk
Prompt
Drive
```

`Dashboard` remains available only as a secondary analytics route. `Flow Control` and `Controller` are dormant/frozen for Phase 1 and must not appear in primary navigation.

### 1.2 Route Lock

```text
/               -> /products/new
/products       -> Produk list
/products/new   -> mobile-first intake workflow
/products/[id]  -> product detail with Metadata, Output, History
/prompts        -> Paket Prompt editor surface
/drive          -> visual Drive manager
/dashboard      -> secondary analytics route
/settings       -> Pengaturan hub
/controller     -> frozen route redirect to /products/new
/flow           -> frozen route redirect to /products/new
```

The topbar right action is the approved Settings gear entry point on every non-Settings route. `/settings` must not render a right-side topbar action. Settings is not a bottom navigation item in Phase 1, and the shell must not show a workspace picker.

Compatibility routes remain available, but are not primary surfaces:

```text
/intake   -> /products/new
/outputs  -> compatibility/archive view only
/gemini   -> primarily accessed from Pengaturan
```

When `/controller` or `/flow` is opened during Phase 1, the app redirects the operator to `/products/new`. The Flow/Controller backend must not be deleted as part of this freeze.

`Sign out` must live only in `Pengaturan > Account`.

### 1.3 Required Step Order

```text
Mobile intake upload
-> Analisis Gemini
-> Metadata review
-> Affiliate Profile selection / binding
-> Paket Prompt preview/edit/regenerate
-> Drive visual asset review
-> Output/history when available
```

### 1.4 Intake UX

Before Gemini analysis, intake is upload-only.

Required upload cards:

- `Foto Produk Utama`: at least 1 product image.
- `Screenshot Shopee`: at least 1 Shopee marketplace screenshot.
- `Screenshot TikTok`: at least 1 TikTok marketplace screenshot.

Optional uploads:

- additional product images.
- additional marketplace screenshots.
- direct mobile camera capture for supported browsers.

Forbidden before Gemini analysis:

- product title field.
- marketplace account field.
- manual product metadata fields.
- claims that a marketplace link was visually parsed without image bytes.

Main action:

```text
Analisis Gemini
```

Live Gemini analysis is required for real E2E acceptance. Mock mode is allowed only as a clearly labeled development fallback.

The upload UI must provide local image preview before submit. While Gemini is processing, loading state should use product-card or preview-card skeletons instead of only a small spinner.

### 1.5 Metadata Review

After Gemini analysis, the operator reviews and edits Prompt Essentials:

```text
Nama Produk
Keyword Cari Etalase
Deskripsi Visual
Use Case
Pain Point
Selling Angle
Target Viewer
```

### 1.6 Prompt UX

The prompt surface label is:

```text
Paket Prompt
```

Required editable fields:

```text
Prompt Clip 1
Prompt Clip 2
Caption
Tags
Target Marketplace
Instruksi Revisi
```

Each clip panel must expose `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt` as editable fields. `Caption` is shared, `Tags` render as a hashtag string, and `Target Marketplace` is a fixed read-only chip for `Shopee + TikTok`.

Required actions:

```text
Buat Prompt
Buat Ulang
Tandai Siap Flow
```

Prompt versions must be preserved. Regenerate must not overwrite previous versions without history.

### 1.7 Affiliate Profile Personalization

Affiliate Profile is a top-level persona object and acts as the prompt persona.

Profile-owned locks only:

- character lock.
- environment lock.
- caption/tag style.
- negative prompt rules.

Character and environment are the only profile-owned image assets in Phase awal. The environment asset is the background-lock asset for prompt generation.

There is no separate background-reference asset slot in MVP. Prompt pages must not create per-prompt overrides for character or environment locks in Phase awal. The prompt page may show which profile is active, but the source of personalization remains the Affiliate Profile.

Prompt generation must always consume the active workspace, the workspace-linked or explicitly selected affiliate profile, the profile character/environment Drive references, and the reviewed Gemini metadata for that workspace. If a profile lock is enabled but the matching Drive reference is missing, generation must block instead of falling back.

Each workspace resolves its default-linked affiliate profile when one is configured.

During Phase 1 intake, the operator may explicitly choose an Affiliate Profile using a horizontal mobile-friendly selector. The selected profile is passed into the prompt handoff; no database migration is required solely for this selector unless a later task explicitly approves persistence changes.

### 1.8 Flow Control UX

`/controller` and `/flow` are dormant/frozen in Phase 1. Backend Controller/Flow code and database structures may remain, but the primary UI is hidden and direct route access redirects to `/products/new`.

Controller & Flow Orchestration move to Phase 2 / Backlog. The frozen Phase 2 target remains:

Board columns are exactly:

```text
Prompt Siap
Sedang Flow
Output Masuk
Selesai
```

Each card should show the last action timestamp. Progress is driven by explicit operator actions in the app plus optional Windows Helper metadata callback. The app must not claim automatic Google Flow progress detection unless helper or extension data actually reports it.

Flow account assignment is recommendation-first:

- account must be active.
- account must have enough observed credit.
- account must have available slot.
- `FLOW_FREE` default: 50 credits/day, 10 credits/generate, 1 active slot.
- `FLOW_PLUS` default: reserve/manual priority.
- user confirms the selected account.

No complex visual flow builder, drag-and-drop node editor, or mobile queue manager belongs in Phase 1.

### 1.9 Output Package UX

Required output package fields:

```text
Nama Produk
Keyword Etalase
Caption
Tags
Clip 1
Clip 2
Folder Drive
Status
```

Clip status labels:

```text
Belum Ada
Imported
Approved
```

The app must store Drive links and metadata. Phase awal does not create server-side ZIP files. Download uses Drive file/folder links.

### 1.10 Dashboard

Dashboard is a secondary analytics route in Phase 1. It is not the primary entrypoint and does not appear in primary mobile navigation. Phase 1 analytics priority:

- Gemini task count and status.
- Gemini estimated token/cost if available.
- Drive item count.
- generated file count.
- prompt pack count.
- output/import status count.

### 1.11 Settings Hub

Pengaturan is the configuration hub for:

- Ruang Kerja.
- Akun Affiliate.
- Gemini.
- Google Drive.
- Flow link/status.
- Windows Helper / App API Token.
- Account/logout.

`/settings` is overview-only. The hub must surface compact cards for Workspace, Affiliate Profiles, Gemini, Drive, Account, and Flow link. It must not become the edit form itself and must not create a second global navigation system.

The Settings overview is opened through the global topbar gear on non-Settings routes. This single gear is the approved visual entry point and is not considered a duplicate Settings affordance.

Settings section routes are locked:

```text
/settings/workspace
/settings/affiliate-profiles
/settings/gemini
/settings/drive
/settings/account
```

The Flow card may show frozen/dormant status during Phase 1. Flow Accounts remain controller-owned execution tools for Phase 2, not a separate settings CRUD surface.

Desktop settings sections use list + right side drawer for mutable master data. Mobile settings sections use list cards + full-screen drawer or bottom sheet. The drawer is the only edit surface for Workspace, Affiliate Profiles, and Drive folder records.

Settings > Workspace:

- list + drawer CRUD.
- auto-generated workspace code, hidden from operator UI.
- visible fields: `Nama Ruang Kerja`, `Niche`, `Folder Drive Utama`, `Default`.
- `Niche` uses static suggestions with free fallback.
- `Folder Drive Utama` uses Drive folder picker.
- archive-first lifecycle; hard delete is not a primary action.

Settings > Affiliate Profiles:

- list + drawer CRUD.
- visible base fields: profile name, platform/mode label, account label, affiliate URL, status.
- workspace links are managed in the drawer and one link per workspace can be marked default.
- `notes` is internal metadata only and must not be shown in forms.
- character and environment are two separate image cards.
- each image card supports upload/replace/remove, local preview, Drive reference status, and lock status.
- asset lock is per profile and defaults ON for new profiles.
- if a locked asset ref is missing, prompt generation blocks until the reference is filled.
- rule editors remain editable for i2i, i2v, caption, hashtag, and negative prompt.
- no separate background-reference asset slot exists.

Settings > Gemini:

- single form surface only, not list/history.
- visible fields: `name`, `model`, `purpose`, masked encrypted API key.
- `model` uses a static supported model picker.
- `purpose` uses Analyze / Prompt / OCR-Review / Test.
- actions: Save, Test, Copy Key, Regenerate.
- key code stays internal/hidden.

Settings > Drive:

- folder-centric list + drawer.
- workspace-scoped.
- folders only for Phase awal management.
- visible fields: `name`, `path`, `URL`, `status`.
- actions: Save, Open Folder, Archive.
- drive code stays internal/hidden.

Primary `/drive` Phase 1 surface:

- visual grid/gallery for all Drive items.
- folder items and file items both render as touch-friendly tiles.
- image-like items prefer thumbnail/preview when available.
- tap opens a bottom sheet with preview, metadata, status, path, and Open link action.
- long-press enters client-side multi-select for select/preview state only.
- no batch archive/delete mutation is required in the initial visual manager.

`Pengaturan > Account` owns Chrome profile pairing, App API Token, and sign out. Chrome pairing actions are `Buat`, `Salin`, `Unduh JSON`, and `Lepas Pairing`.

`/controller` helper actions are `Buka Profil`, `Buka Flow`, and `Ekspor Manifest`. Pairing controls do not live there.

Workspace field labels are minimal:

```text
Nama Ruang Kerja
Folder Drive Utama
```

### 1.12 UI Copy Lock

UI language is Indonesian operational copy.

Allowed copy:

- page title.
- section title.
- field label.
- button/action label.
- status label.
- empty state: one short sentence.
- error state: one short sentence.
- overview page summary, only on true overview pages.

Forbidden copy:

- verbose page descriptions.
- repeated explanatory paragraphs.
- marketing copy.
- AI-generated helper text that restates the obvious.

### 1.13 UI and UX Baseline

The final UI must stay minimal, dense, and responsive on mobile and desktop.

Locked baseline:

- Visual PWA Mobile-First references from 2026-05-04 are the active UI baseline.
- Inter is the base typography.
- light native mobile surfaces are the default visual treatment.
- primary action color is `#007AFF`.
- status, topbar, navbar, surface, border, and inactive component colors come from the visual design tokens.
- compact operational spacing.
- no oversized hero blocks on functional pages.
- 8px radius or less for cards and framed surfaces unless a component already has a stronger local rule.
- clear type hierarchy with page title above section title above card title above label/body.
- the only global Settings affordance is the topbar gear on non-Settings routes.
- shared custom picker for choice fields instead of raw browser dropdowns.
- static suggestions with free fallback for non-relational text fields that still need loose input.
- loading, empty, and error states on every active surface.
- desktop list surfaces prefer searchable table + side drawer.
- mobile list surfaces prefer compact cards + full-screen drawer or bottom sheet.
- CRUD create entrypoints appear only in page header and empty state CTA.
- row actions are `Open` plus edit/archive/delete in overflow.
- archive-first lifecycle is required; hard delete is rare and never the default.
- primary mobile navigation is fixed bottom navigation with safe-area padding.
- bottom sheets must account for `env(safe-area-inset-bottom)` and sit above the bottom nav.
- Phase 1 native-feel gestures are limited to pull-to-refresh indicator, bottom-sheet dismiss, and Drive long-press select.
- every gesture must have a tap/click fallback.

Recommended hierarchy:

```text
Global heading L: Inter 20/24, 600
Sub-heading M: Inter 16/18.4, 600
Component heading S: Inter 14/15.4, 600
Body M: Inter 12/12.6, 400
Label/Button: Inter 12/12.6, 600
Meta/Status: Inter 10/10, 400
```

## 2. Product Vision

1. Reduce manual work in intake and prompt preparation.
2. Keep images, screenshots, prompts, Flow assignments, and outputs organized by product and workspace.
3. Keep Flow accounts global execution tools, not workspace-bound.
4. Allow unlimited top-level affiliate profiles with editable prompt rules and explicit workspace links.
5. Use mobile for upload/review/prompt work and desktop for Flow execution.
6. Keep Supabase as metadata source of truth and Google Drive as asset source of truth.

## 3. MVP Definition

MVP means the system can:

- Log in through Supabase Auth.
- Create a workspace and store its Drive root folder metadata.
- Create an affiliate profile and link it to one or more workspaces.
- Open the app at `/products/new` as the Phase 1 entrypoint.
- Install or launch as a basic PWA through `manifest.json` and mobile meta tags.
- Upload or capture real product images and marketplace screenshots.
- Run live Gemini analysis from uploaded image bytes.
- Review and edit generated product metadata.
- Select an Affiliate Profile for prompt handoff.
- Generate, edit, regenerate, persist, and version prompt packs.
- Browse Google Drive metadata through a touch-friendly visual grid.
- Review output package links and history in the app.
- Show dashboard counts for Gemini, Drive, prompts, and outputs as a secondary route.

Phase 2 / Backlog capabilities:

- Assign ready prompt packs to global Flow accounts based on status, credit, and availability.
- Export/download a batch manifest for Windows Helper.
- Use Windows Helper to open the correct Chrome profile and Google Flow URL.
- Let the operator run Google Flow manually.
- Let Windows Helper rename/upload generated clips to Google Drive and post metadata back to the app.

## 4. Locked Architecture

### 4.1 Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI: mobile-first PWA shell for intake, prompt, and Drive visual management
Primary nav: Intake, Produk, Prompt, Drive
Phase 1 entrypoint: /products/new
```

### 4.2 Auth

```text
Provider: Supabase Auth
User model: single owner/operator
Team/role permission: out of scope MVP
```

### 4.3 Database

```text
Database: Supabase Postgres
Metadata source of truth: Supabase
RLS: enabled on all owner-owned tables
```

### 4.4 Asset Storage

```text
Asset/file source of truth: Google Drive
Supabase Storage: not used for large video/image assets in MVP
Supabase stores: Drive item metadata, URLs, paths, MIME type, status, relations
```

### 4.5 AI

```text
AI provider: Gemini API
Keys: encrypted and server-only
Structured JSON outputs: required
Prompt rules: editable in UI, not hardcoded in JSX/HTML
```

### 4.6 Execution

```text
Google Flow is the external executor
Flow Control manages a global Flow account pool
Flow accounts are global tools and never workspace-bound
Flow account management belongs to /controller support panels, not Settings CRUD
Windows Helper opens Chrome profile + Flow URL and imports outputs
Google Flow generation remains manual
Phase 1 state: Dormant/Frozen
```

### 4.7 Windows Helper

Windows Helper is in Phase awal scope as a local companion, not a hosted service.

Helper responsibilities:

- read/import app batch manifest JSON.
- resolve `flow_account_code` to a local Chrome profile path from local helper config.
- open the selected Chrome profile and Google Flow URL.
- watch the configured local output folder.
- rename output files using the locked naming pattern.
- upload output files directly to Google Drive using local OAuth.
- post metadata callback to the app using App API Token.

Helper boundaries:

- no Google Flow auto-click.
- no Google Flow prompt auto-submit.
- no TikTok/Shopee upload.
- no Chrome profile path stored in Supabase.
- no Drive OAuth refresh token stored in Supabase for helper upload.

### 4.8 Mobile PWA Control

Mobile is for upload, review, prompt preparation, and Drive visual management. Phase 1 PWA scope is manifest/meta installability only; no service worker, offline cache strategy, background sync, or IndexedDB/localStorage data persistence is required.

The shell must support safe-area layout for bottom navigation and bottom sheets. Pull-to-refresh may show a lightweight gesture indicator and call `router.refresh()`.

## 5. Source of Truth Hierarchy

| Area | Source of Truth |
|---|---|
| App flow and nav | This PRD |
| Architecture | `docs/ARCHITECTURE_LOCK.md` |
| Metadata | Supabase Postgres |
| File bytes and asset folders | Google Drive |
| File metadata | `drive_items` in Supabase |
| Gemini keys and tasks | Supabase server-only metadata/secrets |
| Prompt rules | Affiliate Profile + prompt pack JSON |
| Flow execution | Phase 2 Google Flow manual execution + Flow Control manifest |
| Chrome profile mapping | Windows Helper local config |
| Helper Drive OAuth | Windows Helper local token store |
| Output history | Supabase + Drive metadata |
| Analytics | Supabase + derived estimates when needed |

## 6. Non-Goals / Do Not Build in MVP

- Auto upload TikTok/Shopee.
- Video editor inside the PWA.
- Browser automation that clicks or submits Google Flow automatically.
- Custom remote desktop engine.
- Multi-user/team permissions.
- Google Flow Business/Enterprise/Pro support.
- Hardcoded prompt rules in code.
- Workspace-bound Flow accounts.
- Fixed-count affiliate profiles or fixed Flow account pool size.
- Chrome profile paths stored in Supabase.
- Helper Drive OAuth refresh tokens stored in Supabase.
- Claims of visual parsing from links when image bytes are not available.
- Supabase Storage for large video/image assets.
- Server-side ZIP generation for output packages.
- Bypassing provider quotas or rate limits.
- Complex visual flow builders.
- Drag-and-drop node editors.
- Dense data tables for mobile views.
- Service worker or offline cache engine in Phase 1.

## 7. Final MVP Lock Statement

```text
Affiliate AI Content OS MVP is a private AI production control center.

It manages mobile product intake, Gemini metadata extraction, affiliate-profile prompt personalization, prompt pack versioning, Drive-based visual asset metadata, output packages, and secondary dashboard counts.

It does not generate videos internally, edit videos, auto-click Google Flow, auto-upload to TikTok/Shopee, build a custom remote desktop engine, or expose Controller/Flow as a primary Phase 1 UI.
```
