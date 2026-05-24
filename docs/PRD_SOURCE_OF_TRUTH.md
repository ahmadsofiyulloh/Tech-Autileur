# PRD v1 Final - Banplex OS MVP

**Status:** PHASE 1 PASS BASELINE; PHASE 2 MICRO-TASK IMPLEMENTATION LOCK
**Version:** 1.3 Phase 1 Visual PWA Override Lock
**Date:** 2026-05-04
**Primary Operator:** Single owner/operator
**Implementation Target:** Next.js PWA + Supabase + Google Drive + Gemini API + Google Flow workflow + Windows Helper
**Implementation Mode:** Codex CLI with strict source-of-truth docs and Git checkpoints
**Visual Override:** The Visual PWA Mobile-First references approved on 2026-05-04 override older shell and UI baseline decisions when they conflict.

## Phase Status

```text
Phase 1 MVP Baseline: PASS
Current Active Phase: Phase 2 Micro-Task Implementation
Phase 2 Lock Status: LOCKED FOR MICRO-TASK IMPLEMENTATION
```

This PRD remains the locked Phase 1 baseline. Phase 2 may extend the system only through `docs/PHASE_2_ARCHITECTURE_LOCK.md` and approved micro-task backlog updates. Phase 2 work must not silently change the Phase 1 route, mobile, storage, security, prompt, or Flow constraints documented here.

## 0. Executive Summary

Banplex OS is a private operator tool for AI affiliate content production. Phase 1 prioritizes a mobile-first PWA loop for product screenshot intake, Gemini Vision metadata extraction, affiliate-profile prompt personalization, and visual Google Drive asset management.

This MVP is an AI production control center. It is not a video editor, not an auto-uploader to TikTok/Shopee, and not a browser automation system.

Phase 1 freezes Controller and Flow orchestration as primary UI surfaces. Existing backend logic may remain for later reuse, but the operator-facing Phase 1 experience must focus on Intake, Produk, Prompt, and Drive.

## 0.1 2026-05-06 Personal-Use Refactor Lock

The latest operator brief on 2026-05-06 updates the earlier workspace/profile interpretation.

Locked decisions:

- `Akun Affiliate` is the visible top-level namespace for the operator.
- One Affiliate Profile owns one internal workspace/folder namespace.
- The active Affiliate Profile is changed from Settings overview; activating a profile also activates its owned internal workspace namespace.
- Products, intake sessions, prompt packs, and prompt history must not mix across Affiliate Profiles.
- `Workspace` remains as internal storage/scope infrastructure for now; it is not a user-facing planning concept during this refactor.
- Gemini API keys and Google Drive connection remain global user config shared by all Affiliate Profiles.
- Google Drive uses the fixed `/AffiliateAI/` structure and provisions required folders automatically. The operator must not manually paste Drive folder links for normal setup.
- Cutoff preserves only auth profiles, Gemini key metadata/secrets, and Google Drive connection metadata.

Implementation constraints:

- Do not remove the `workspaces` schema in this refactor.
- Do not add broad schema cleanup unless a later task explicitly approves it.
- Do not introduce a global workspace picker.
- Do not add new explanatory UI copy, helper text, marketing text, or duplicate descriptions. Only labels explicitly documented here or already present in the app are allowed.
- Each implementation micro-task must be small, independently verified, and must not refactor unrelated modules.

## 0.2 2026-05-07 Intake Metadata Refactor Lock

The Intake refactor is locked by `docs/intake-metadata-refactor-contract-2026-05-07.md`.

Locked decisions:

- `Simpan Produk` and `Analisis Metadata` are separate lifecycle actions.
- Product capture must be durable before Gemini metadata analysis succeeds.
- `Simpan Produk` is enabled with at least one `Foto Produk Utama`.
- A newly captured product remains `DRAFT`; metadata readiness is not inferred from `products.status`.
- At least one Shopee or TikTok screenshot is required for metadata analysis, not for the first product save.
- Gemini failure must leave the saved product recoverable with visible retry/failure state.
- Intake stays on `/products/new` after save and after successful metadata analysis.
- Intake does not expose Affiliate Profile switching. It shows the active Affiliate Account context and readiness only.
- No schema migration is approved for the first implementation wave.

## 1. Locked App Flow and UX

### 1.1 Main Navigation

Workflow navigation labels are exactly:

```text
Intake
Produk
Prompt
Drive
```

Mobile bottom navigation labels are exactly:

```text
Dashboard
Intake
Produk
Prompt
Drive
```

`Dashboard` remains available as the secondary analytics route in the shell nav. `Flow Control` and `Controller` are dormant/frozen for Phase 1 and must not appear in the workflow navigation.

### 1.2 Route Lock

```text
/               -> /products/new
/products       -> Produk list
/products/new   -> mobile-first intake workflow
/products/[id]  -> product detail with Metadata, Output, History
/prompts        -> Paket Prompt list/launcher
/prompts/[id]   -> prompt detail/editor output surface
/prompts/[id]/history -> prompt generation history
/drive          -> visual Drive manager
/dashboard      -> secondary analytics route
/settings       -> Pengaturan hub
/controller     -> frozen route redirect to /products/new
/flow           -> frozen route redirect to /products/new
```

The topbar has two distinct global controls: Notifications and Profile avatar menu. The Profile avatar opens the profile overview and includes menu actions for `Pengaturan` and `Sign out`. `/settings` remains the locked Pengaturan hub route and must not render a duplicate standalone Settings gear/action. Settings is not a bottom navigation item in Phase 1, and the shell must not show a workspace picker.

Compatibility routes remain available, but are not primary surfaces:

```text
/intake   -> /products/new
/outputs  -> compatibility/archive view only
/gemini   -> primarily accessed from Pengaturan
```

When `/controller` or `/flow` is opened during Phase 1, the app redirects the operator to `/products/new`. The Flow/Controller backend must not be deleted as part of this freeze.

`Sign out` is allowed from the Profile avatar menu and remains available from `Pengaturan > Account`.

### 1.3 Required Step Order

```text
Mobile intake product capture
-> Simpan Produk
-> complete marketplace screenshot evidence
-> Analisis Metadata
-> Metadata review
-> active Affiliate Account readiness binding
-> Paket Prompt generated output/regenerate
-> Drive visual asset review
-> Output/history when available
```

### 1.4 Intake UX

Before metadata analysis, intake is upload-only.

Upload cards:

- `Foto Produk Utama`: at least 1 product image.
- `Screenshot Shopee`: optional Shopee marketplace screenshot.
- `Screenshot TikTok`: optional TikTok marketplace screenshot.

Save and analysis lifecycle:

- `Simpan Produk` is the first durable capture action and requires only `Foto Produk Utama`.
- Saved products remain `DRAFT` until a later explicit workflow transition.
- `Analisis Metadata` is a separate action and requires `Foto Produk Utama` plus at least one of `Screenshot Shopee` or `Screenshot TikTok`.
- Metadata readiness is derived from intake session metadata/review state and action state, not from `products.status`.
- If Gemini fails or is slow, the product remains visible and retryable.

Optional uploads:

- additional product images.
- additional marketplace screenshots.
- direct mobile camera capture for supported browsers.

Forbidden before metadata analysis:

- product title field.
- marketplace account field.
- manual product metadata fields.
- claims that a marketplace link was visually parsed without image bytes.

Primary actions:

```text
Simpan Produk
Analisis Metadata
```

Live Gemini analysis is required for real E2E acceptance. Mock mode is allowed only as a clearly labeled development fallback.

The upload UI must provide local image preview before submit. While Gemini is processing, loading state should use product-card or preview-card skeletons instead of only a small spinner.

Mobile preview layout must use one unified upload/product/metadata surface. The upload cards for `Foto Produk Utama`, `Screenshot Shopee`, and `Screenshot TikTok` render as three equal mini preview cards without a tab split. Saved draft products can appear as a compact queue/drive-like surface while metadata is pending, generating, failed, or waiting for review.

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

Product detail `Metadata` tab displays screenshot OCR only, using read-only copy fields with `Salin` actions. It must not surface technical audit data such as Drive IDs, paths, schema versions, task IDs, raw JSON, or extraction diagnostics in the main Metadata tab.

### 1.6 Prompt UX

The prompt surface label is:

```text
Paket Prompt
```

Read-only generated fields:

```text
Prompt Clip 1
Prompt Clip 2
Caption
Tags
Target Marketplace
```

Editable regeneration field:

```text
Instruksi Revisi
```

Each clip panel must expose `First Frame Image` and `I2V Prompt` as read-only copy-ready fields after generation. `First Frame Image` is stored in the legacy `I2I First Frame` field as one single-frame image, while `I2I Last Frame` remains persisted and hidden for legacy compatibility. `I2V Prompt` animates from the `@firstframe` single image, keeps legacy `@lastframe` only as a compatibility input, and must not reference storyboard panels, grid borders, or panel numbers. `Caption` is shared and copy-ready, `Tags` render as a copy-ready hashtag string, and `Target Marketplace` is a fixed read-only chip for `Shopee + TikTok`.

Required actions:

```text
Buat Prompt
Buat Ulang
```

Prompt versions must be preserved. Regenerate must not overwrite previous versions without history.

Phase 1 controller is frozen: `GENERATED` is the final operator-facing prompt status. Controller readiness actions such as `Tandai Siap Flow` are retained only for dormant backend compatibility and must not be exposed in the Phase 1 prompt UI.

### 1.7 Affiliate Profile Personalization

Affiliate Profile is the top-level operator namespace and prompt persona.

Each Affiliate Profile owns one internal workspace/folder namespace. The internal workspace isolates products, intake rows, prompt packs, Drive metadata relations, and prompt history for that profile. The operator should understand and operate through `Akun Affiliate`, not through free many-to-many workspace planning.

Profile-owned locks only:

- character lock.
- environment lock.
- caption/tag style.
- negative prompt rules.

Character and environment are the only profile-owned image assets in Phase awal. The environment asset is the background-lock asset for prompt generation.

There is no separate background-reference asset slot in MVP. Prompt pages must not create per-prompt overrides for character or environment locks in Phase awal. The prompt page may show which profile is active, but the source of personalization remains the Affiliate Profile.

Prompt generation must always consume the active Affiliate Profile, that profile's internal workspace namespace, the profile character/environment Drive references, and reviewed Gemini metadata inside the same namespace. Phase 2 Bulk Import rows may skip manual OCR/Vision review only after Gemini enriches the `bulk_import_v1` scraping seed into complete Prompt Essentials and the app writes that enriched payload as reviewed metadata. If a profile lock is enabled but the matching Drive reference or cached analysis JSON is missing, generation must block instead of falling back.

If only one Affiliate Profile exists, it may be treated as the active profile. When multiple profiles exist, the active profile must be resolved from the current namespace contract before prompt generation.

During Phase 1 intake, the operator does not switch Affiliate Profiles. Intake shows a compact active Affiliate Account card with avatar/readiness and an edit shortcut. The former horizontal carousel is removed from Intake because one active profile namespace is the working context.

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

Dashboard is a secondary analytics route in Phase 1. It appears in the shell nav and is not the primary workflow entrypoint. Phase 1 analytics priority:

- Gemini task count and status.
- Gemini estimated token/cost if available.
- Drive item count.
- generated file count.
- prompt pack count.
- output/import status count.

### 1.11 Settings Hub

Pengaturan is the configuration hub for:

- Akun Affiliate.
- Gemini.
- Google Drive.
- Flow link/status.
- Windows Helper / App API Token.
- Account/logout.

`/settings` is overview-only. The hub must surface compact cards for Affiliate Profiles, Gemini, Drive, Account, and Flow link. Workspace may remain visible only as retained internal support until its UI is removed by a dedicated micro-task. It must not become the operator's primary planning concept.

The Settings overview is opened from the Profile avatar menu `Pengaturan` action. The topbar must not add a separate standalone Settings gear; Notifications and the Profile avatar menu are the two approved global controls.

The top of `/settings` may surface a compact Gemini Usage overview before the settings card groups. It shows current app-side `RPD`, `RPM`, and `TPM` usage against model-derived limits, grouped by `project + model` when project metadata exists. With multiple Gemini keys, the overview uses a carousel with mobile swipe. The card uses a thick, static donut chart on the left half and quota numbers on the right half; chart tap should not open tooltip/focus framing. When no key/usage card is available, only the inline header row remains.

Settings section routes are locked:

```text
/settings/workspace
/settings/affiliate-profiles
/settings/gemini
/settings/account
/settings/drive -> compatibility redirect to /settings
```

The Flow card may show frozen/dormant status during Phase 1. Flow Accounts remain controller-owned execution tools for Phase 2, not a separate settings CRUD surface.

Desktop settings sections use list + right side drawer for mutable master data. Mobile settings sections use list cards + full-screen drawer or bottom sheet. The drawer is the only edit surface for Workspace, Affiliate Profiles, and Drive folder records.

Settings > Workspace:

- list + drawer CRUD.
- auto-generated workspace code, hidden from operator UI.
- visible fields: `Nama Ruang Kerja`, `Niche`, `Default`.
- `Niche` uses static suggestions with free fallback.
- Drive folder refs remain internal metadata and are provisioned automatically from the fixed `/AffiliateAI/` structure.
- archive-first lifecycle; hard delete is not a primary action.
- retained only as internal support during the Affiliate Profile namespace refactor.
- new feature work must not expand Workspace UX.

Settings > Affiliate Profiles:

- list + drawer CRUD.
- overview may show linked profile avatar thumbnails and a quick active profile switch.
- visible base fields: profile name, platform/mode label, account label, affiliate URL, status.
- one internal workspace/folder namespace is maintained per profile.
- activating a profile updates the active internal workspace namespace and the default profile link for that namespace.
- many-to-many workspace choices must not be exposed in the drawer during this refactor.
- `notes` is internal metadata only and must not be shown in forms.
- character and environment are two separate image cards.
- each image card supports upload/replace/remove, local preview, Drive reference status, and lock status.
- lock controls must be visible in the asset section using only these labels: `Lock Character`, `Lock Environment`.
- asset lock is per profile and defaults ON for new profiles.
- if a locked asset ref or cached analysis JSON is missing, prompt generation blocks until the reference is filled and analyzed.
- rule editors remain editable for i2i, i2v, caption, hashtag, and negative prompt.
- no separate background-reference asset slot exists.

Settings > Gemini:

- multi-key list + drawer CRUD, not a history page.
- visible fields: `name`, `project`, `model`, `purpose`, masked encrypted API key.
- `model` uses a static supported model picker.
- `purpose` uses the locked Gemini role picker.
- quota fields are not shown; `RPM`, `RPD`, and `TPM` are stored automatically from the selected model.
- active keys require a non-empty project label so usage can group by `project + model`.
- actions: Gemini baru, Kelola, Simpan, Disable.
- Test, Copy Key, and Regenerate are out of scope for the MVP UI.
- key code stays internal/hidden.

Connected Services > Google Drive:

- Google Drive connect/status lives in the `/settings` overview row.
- `Connect` is shown only when disconnected.
- the row uses a local Drive asset icon and stays non-navigating.
- `/settings/drive` is a compatibility redirect only and does not expose a dedicated UI.
- Drive folder provisioning is automatic and static under `/AffiliateAI/`; no manual Drive folder setup UI is exposed.

Primary `/drive` Phase 1 surface:

- hierarchical Drive browser starting at the active Affiliate Account workspace root.
- folder items navigate into their direct children instead of rendering descendants in the same level.
- file/image items open preview; folder and file items both render as touch-friendly grid tiles.
- Grid and List view modes are available; mobile List mode must stay compact and must not become a dense table.
- image-like items prefer thumbnail/preview when available.
- file tap opens a bottom sheet with preview, metadata, status, path, and Open link action on mobile; desktop may use the right-side preview drawer.
- long-press enters client-side multi-select for select/preview state only.
- no batch archive/delete mutation is required in the initial visual manager.

`Pengaturan > Account` owns Chrome profile pairing and App API Token. `Sign out` may appear there and in the Profile avatar menu. Chrome pairing actions are `Buat`, `Salin`, `Unduh JSON`, and `Lepas Pairing`.

`/controller` helper actions are `Buka Profil`, `Buka Flow`, and `Ekspor Manifest`. Pairing controls do not live there.

Workspace field labels are minimal:

```text
Nama Ruang Kerja
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
- non-badge UI color is neutral black/white/grayscale through shared tokens; primary actions must not use blue or gradient backgrounds.
- status badges may retain semantic status colors.
- status, topbar, navbar, surface, border, and inactive component colors come from the visual design tokens.
- compact operational spacing.
- no oversized hero blocks on functional pages.
- 8px radius or less for cards and framed surfaces unless a component already has a stronger local rule.
- clear type hierarchy with page title above section title above card title above label/body.
- topbar global controls are Notifications and the Profile avatar menu; Settings is a Profile menu action, not a standalone global gear.
- shared custom picker for choice fields instead of raw browser dropdowns.
- static suggestions with free fallback for non-relational text fields that still need loose input.
- loading, empty, and error states on every active surface.
- desktop list surfaces prefer searchable table + side drawer.
- mobile list surfaces prefer compact cards + full-screen drawer or bottom sheet.
- CRUD create entrypoints appear only in page header and empty state CTA.
- row actions are `Open` plus edit/archive/delete in overflow.
- archive-first lifecycle is required; hard delete is rare and never the default.
- mobile shell navigation is fixed bottom navigation with safe-area padding.
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
2. Keep images, screenshots, prompts, Flow assignments, and outputs organized by product and Affiliate Profile namespace.
3. Keep Flow accounts global execution tools, not workspace-bound.
4. Allow unlimited top-level affiliate profiles with editable prompt rules and one isolated internal workspace/folder namespace each.
5. Use mobile for upload/review/prompt work and desktop for Flow execution.
6. Keep Supabase as metadata source of truth and Google Drive as asset source of truth.

## 3. MVP Definition

MVP means the system can:

- Log in through Supabase Auth.
- Create an affiliate profile with its isolated internal workspace/folder namespace.
- Open the app at `/products/new` as the Phase 1 entrypoint.
- Install or launch as a basic PWA through `manifest.json` and mobile meta tags.
- Upload or capture real product images and marketplace screenshots.
- Run live Gemini analysis from uploaded image bytes.
- Review and edit generated product metadata.
- Use active Affiliate Account readiness for prompt handoff.
- Generate, review copy-ready output, regenerate, persist, and version prompt packs.
- Browse Google Drive metadata through a touch-friendly hierarchical Drive browser with Grid/List modes.
- Review compact Gemini usage versus model quota from Settings.
- Review output package links and history in the app.
- Show dashboard counts for Gemini, Drive, prompts, and outputs as a secondary route.

Phase 2 / Backlog capabilities are now locked in `docs/PHASE_2_ARCHITECTURE_LOCK.md`. The locked sequence includes:

- Scale prompt production through a controlled Prompt Batch Workbench and durable AI job queue.
- Harden server-side product, prompt, Drive, and batch list behavior for large datasets.
- Retain dormant controller compatibility for assigning ready prompt packs to global Flow accounts based on status, credit, and availability.
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
Shell nav: Dashboard, Intake, Produk, Prompt, Drive
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
- resolve `flow_account_code` and `chrome_profile_lane_key` to a local Chrome profile path from local helper config.
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
| Gemini usage analytics | Supabase `gemini_api_usage_events` derived from app-side Gemini requests |
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
Banplex OS MVP is a private AI production control center.

It manages mobile product intake, Gemini metadata extraction, affiliate-profile prompt personalization, prompt pack versioning, Drive-based visual asset metadata, output packages, and secondary dashboard counts.

It does not generate videos internally, edit videos, auto-click Google Flow, auto-upload to TikTok/Shopee, build a custom remote desktop engine, or expose Controller/Flow as a primary Phase 1 UI.
```
