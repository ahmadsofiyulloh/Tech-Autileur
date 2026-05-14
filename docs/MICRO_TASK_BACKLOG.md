# Micro Task Backlog - Phase Awal MVP

This backlog replaces older sprint assumptions. Implement one micro-task at a time.

## Progress Snapshot

Completed on this branch, audit-backed via `docs/BACKLOG_AUDIT.md`:

- S0-001
- S1-001, S1-002, S1-003
- S2-001, S2-002, S2-003
- S3-001, S3-002, S3-003
- S4-001, S4-002, S4-003, S4-004, S4-005
- S5-001, S5-002, S5-003, S5-004
- S6-001, S6-002, S6-003, S6-004, S6-005, S6-006, S6-007, S6-008, S6-009, S6-010, S6-011, S6-012
- MT-GEMINI-FREE-TIER-01
- S7-001
- S8-001, S8-002, S8-003, S8-004, S8-005, S8-006, S8-007
- VIS-001, VIS-002, VIS-003, VIS-004, VIS-005, VIS-006

## UI/UX Polish References
- [UI_UX_POLISH_SEGMENT_A_TOKEN_AUDIT_PROMPT.md](UI_UX_POLISH_SEGMENT_A_TOKEN_AUDIT_PROMPT.md)
- [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
- [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
- [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
- [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
- [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
- [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)

## S0 - Docs and Source of Truth Sync

### S0-001 - Align Phase awal lock docs _(DONE)_
**Goal:** Make PRD, architecture, schema, Flow, mobile, prompt, Drive, and acceptance docs describe the same app flow.
**Owner:** Codex
**Acceptance:** no doc treats Flow accounts as workspace-bound, mobile Flow Control as primary, duplicate Settings entry points as acceptable, or verbose UI copy as allowed.

### MT-REF-00 - Affiliate Profile namespace docs lock _(DONE)_
**Goal:** Lock the 2026-05-06 personal-use refactor: `Akun Affiliate` is the visible top-level namespace, Workspace is internal infrastructure, one profile owns one internal namespace, and implementers may not add unapproved UI copy.
**Owner:** Codex
**Scope:** docs only.
**Acceptance:** PRD, architecture, schema, prompt lock, and backlog all describe the same namespace model, cutoff preserve list, and no-assumption implementation constraints.

### MT-REF-01 - Early Supabase cutoff _(DONE)_
**Goal:** Clear test operational data before runtime refactor while preserving only auth profiles, Gemini key metadata/secrets, and Google Drive connection metadata.
**Owner:** Codex
**Scope:** Supabase DML only; no schema changes and no Google Drive file deletion.
**Acceptance:** row counts confirm preserved tables remain and operational tables are empty.

### MT-REF-02 - Visible Affiliate Profile lock controls _(DONE)_
**Goal:** Move lock controls into the visible asset section of the Affiliate Profile drawer.
**Owner:** Codex
**Scope:** Affiliate Profile settings UI only.
**Acceptance:** `Lock Character` and `Lock Environment` are visible beside the asset cards; no new explanatory copy is added.

### MT-REF-03 - One profile one internal namespace _(DONE)_
**Goal:** Remove many-to-many workspace choices from the Affiliate Profile drawer and submit exactly one internal namespace link per profile.
**Owner:** Codex
**Scope:** Affiliate Profile UI/action path only; keep existing schema.
**Acceptance:** create/update sends one `workspace_ids` value and one `default_workspace_id`; no checkbox list of workspaces remains in the drawer.

### MT-REF-04 - Prompt readiness guards _(DONE)_
**Goal:** Block prompt creation/generation/regeneration unless the active profile, internal namespace, reviewed metadata, source image, required rules, and locked asset analysis JSON are ready.
**Owner:** Codex
**Scope:** prompt server path and minimal prompt launcher status only.
**Acceptance:** missing requirements fail with clear existing-style errors before Gemini request creation.

### MT-REF-05 - Strict prompt JSON runtime _(DONE)_
**Goal:** Remove prompt runtime fallback paths that convert prose, missing source echoes, legacy full Gemini shape, or weak editor payloads into accepted output.
**Owner:** Codex
**Scope:** prompt contract parser/reader and targeted tests.
**Acceptance:** invalid prompt JSON fails instead of creating empty `visual_references` or empty `prompt_rules`.

### MT-PROMPT-QUALITY-01 - Prompt pack v2 copy contract _(DONE)_
**Goal:** Refactor generated prompt copy JSON so I2I/I2V outputs are explicit operator instructions instead of raw rule/reference dumps.
**Owner:** Codex
**Scope:** prompt generation contract, Gemini schema, parser/reader, targeted tests, and prompt/Flow lock docs only.
**Acceptance:** new generation emits v2 copy JSON; I2I First Frame uses `@character`, `@environment`, and product reference; I2I Last Frame uses `@firstframe`; I2V uses `@firstframe` and `@lastframe` with 8-second 4-part timeline; legacy prompt packs remain readable.

### MT-INTAKE-00 - Intake metadata refactor contract
**Goal:** Lock the 2026-05-07 save-vs-metadata lifecycle, active account behavior, drawer fallback, and mobile preview contract before runtime refactor.
**Owner:** Codex
**Scope:** docs only.
**Acceptance:** `docs/intake-metadata-refactor-contract-2026-05-07.md` exists and core docs reference the separated `Simpan Produk` / `Analisis Metadata` lifecycle.

### MT-INTAKE-01 - Durable product capture before metadata
**Goal:** Let Intake save a recoverable `DRAFT` product with product image only, without requiring Gemini success.
**Owner:** Codex
**Scope:** Intake action/server path and Intake page state only.
**Acceptance:** product capture persists before metadata analysis, Gemini failure does not discard the saved product, and metadata readiness is not inferred from `products.status`.

### MT-INTAKE-02 - Unified mobile preview grid
**Goal:** Replace the product/screenshot tab split with one upload/product/metadata surface and three equal mini preview cards.
**Owner:** Codex
**Scope:** `/products/new` Intake UI and reusable preview/skeleton components only.
**Acceptance:** product, Shopee, and TikTok previews render in a compact responsive grid; saved Drive-backed previews display when available; no upload tabs remain.

### MT-INTAKE-03 - Metadata analysis fallback and retry
**Goal:** Make metadata pending, generating, ready, failed, and review states visible and retryable.
**Owner:** Codex
**Scope:** Intake metadata action state, skeleton loading, and failure UI only.
**Acceptance:** analysis uses preview/product skeletons, failed metadata keeps the draft visible, retry is explicit, and success stays on Intake.

### MT-INTAKE-04 - Active account card in Intake
**Goal:** Replace the Intake profile carousel with a compact active Affiliate Account readiness card and edit shortcut.
**Owner:** Codex
**Scope:** Intake account context UI and existing drawer entry only.
**Acceptance:** Intake does not expose profile switching, shows active account readiness, and opens the inline edit drawer from the card.

### MT-INTAKE-05 - Affiliate drawer lock and reanalysis polish
**Goal:** Align the drawer with conditional Character/Environment preview and robust reanalysis feedback.
**Owner:** Codex
**Scope:** Affiliate Profile drawer UI only.
**Acceptance:** preview grids respect lock toggles, reanalysis pending/success/failure is inline, and drawer remains open after success.

### MT-INTAKE-06 - Action placement and inline status polish
**Goal:** Keep primary operator actions visible and prevent mobile inline status overlap.
**Owner:** Codex
**Scope:** Overview/profile action placement, prompt TXT action placement, and reusable product/intake card status patterns.
**Acceptance:** primary actions are direct when space allows, overflow is secondary-only, and long card statuses truncate or line-clamp safely.

### MT-INTAKE-07 - Intake refactor regression QA and progress sync _(DONE)_
**Goal:** Verify the refactor with lint/typecheck/build and targeted smoke coverage, then update progress docs with evidence.
**Owner:** Codex
**Scope:** QA evidence and docs progress only after runtime tasks land.
**Acceptance:** verification results are documented; product save, metadata retry/failure, prompt readiness, and drawer reanalysis are covered.

### MT-AFFDRIVE-00 - Active affiliate and automatic Drive lock
**Goal:** Lock that Akun Affiliate is the active operator namespace and Google Drive folder setup is static/automatic under `/AffiliateAI/`.
**Owner:** Codex
**Scope:** source-of-truth docs, Settings overview, workspace/profile server helpers, and Drive target resolution only.
**Acceptance:** changing the active affiliate profile from Settings also changes the internal workspace namespace, Drive no longer requires manual folder URL/path/ref setup, and runtime paths auto-provision missing workspace Drive roots when Google Drive is connected.

### MT-AFFDRIVE-01 - Active Affiliate overview switch
**Goal:** Make `/settings` the simple place to change the active Affiliate Account.
**Owner:** Codex
**Scope:** Settings overview and profile activation action only.
**Acceptance:** the overview shows available active profiles, the current profile is marked, and activating a profile updates both the profile default link and `current_workspace_id`.

### MT-AFFDRIVE-02 - Static automatic Drive provisioning
**Goal:** Remove manual Drive folder setup from operator UX and use automatic `/AffiliateAI/` provisioning.
**Owner:** Codex
**Scope:** Drive root resolver, Workspace settings UI, `/drive`, intake upload, and prompt export target resolution.
**Acceptance:** no manual Drive root URL/path/ref fields are shown, missing workspace Drive root metadata is provisioned before upload/export, and disconnected Google Drive still returns a Connect/setup error instead of manual link instructions.

## VIS - Visual PWA Mobile-First Sync

These tasks document the visual implementation state after the 2026-05-04 Visual PWA Mobile-First override.

### VIS-001 - Design System _(DONE)_
**Goal:** Add visual design tokens, Inter typography, shared card/list/nav/status styling, and light native mobile baseline.
**Owner:** Codex
**Acceptance:** `src/app/globals.css` contains visual token utilities and `src/app/layout.tsx` uses Inter as the app font.

### VIS-002 - App Shell _(DONE)_
**Goal:** Remove the workspace picker from the shell, keep fixed bottom nav for Intake/Produk/Prompt/Drive, and add the topbar Settings gear.
**Owner:** Codex
**Acceptance:** non-Settings routes show one Settings gear, `/settings` shows no right-side topbar action, and safe-area spacing is preserved.

### VIS-003 - Intake _(DONE visually)_
**Goal:** Align `/products/new` with the mobile visual reference using camera-style preview, upload cards, profile carousel, and Gemini skeleton/loading treatment.
**Owner:** Codex
**Acceptance:** affiliate profiles render from real profile data and selected profile handoff does not require a database migration.

Superseded follow-up: MT-INTAKE-02 and MT-INTAKE-04 replace the upload tab/profile carousel pattern with a unified three-card preview grid and active account card.

### VIS-004 - Products and Prompts _(DONE visually)_
**Goal:** Redesign Product and Prompt lists as mobile visual cards using real product/prompt data.
**Owner:** Codex
**Acceptance:** thumbnails use Drive metadata when available, file/icon fallbacks are used otherwise, status chips use semantic tokens, and no fake metrics are added.

### VIS-005 - Drive Visual Manager _(DONE visually)_
**Goal:** Replace the Drive table-first surface with a visual grid/gallery and bottom-sheet preview.
**Owner:** Codex
**Acceptance:** tap opens preview, long-press enters client-side multi-select only, and no batch archive/delete mutation is added.

### VIS-006 - Settings Native List _(DONE visually)_
**Goal:** Convert `/settings` overview into grouped native-style list sections.
**Owner:** Codex
**Acceptance:** Account, Affiliate Profiles, and Connected Services groups are visible when backed by app state, while nested settings routes remain intact.

Known visual/backend gaps:

- No schema migration has been added for Drive thumbnail metadata.
- Drive thumbnails now resolve server-side preview URLs for image-like items when Drive bytes are available, and still fall back to icons/placeholders.
- The shared media thumbnail frame is reused across `/products` and `/drive` for compact PWA/mobile compatibility.
- Drive multi-select is client-side only.
- Settings service status still needs a more explicit backend view-model contract.
- No fake metrics or fake service statuses should be introduced.

## S1 - Navigation and Route Lock

### S1-001 - Lock desktop and mobile nav _(DONE)_
**Goal:** Primary navigation is Intake, Produk, Prompt, Drive. Mobile bottom nav is Intake, Produk, Prompt, Drive.
**Owner:** Codex
**Acceptance:** `/controller` is hidden from primary nav, `/flow` and `/controller` redirect to `/products/new`, Settings is reached by the approved topbar gear on non-Settings routes, and `/settings` has no right-side topbar action.

### S1-002 - Route compatibility _(DONE)_
**Goal:** Keep `/intake`, `/flow`, and `/outputs` compatibility behavior without creating duplicate primary funnels.
**Owner:** Codex
**Acceptance:** `/products/new`, `/prompts`, `/controller`, and product detail remain the locked working surfaces.

### S1-003 - Shell settings and account lock _(DONE)_
**Goal:** Move Sign out and Chrome profile pairing into `Pengaturan > Account`, with no duplicate shell settings entry points.
**Owner:** Codex
**Acceptance:** Settings remains the only configuration hub, the shell uses one approved topbar gear on non-Settings routes, Sign out is not in the header, and Chrome profile pairing includes Buat, Salin, Unduh JSON, and Lepas Pairing.

## S2 - Intake Workflow

### S2-001 - Upload-only intake before Gemini _(DONE)_
**Goal:** `/products/new` shows `Foto Produk Utama`, `Screenshot Shopee`, and `Screenshot TikTok` upload cards before analysis.
**Owner:** Codex
**Acceptance:** no title/account/metadata fields are shown before `Analisis Gemini`.

Superseded follow-up: MT-INTAKE-01 keeps upload-only intake but separates `Simpan Produk` from `Analisis Metadata`, allowing product capture with product image before screenshot evidence is complete. Later evidence lock allows `Analisis Metadata` with at least one Shopee or TikTok screenshot.

### S2-002 - Real Drive upload _(DONE)_
**Goal:** Store uploaded image/screenshot bytes in Google Drive and metadata in Supabase.
**Owner:** Codex
**Acceptance:** real sample files can be uploaded in dev E2E without mock-only storage.

### S2-003 - Live Gemini metadata analysis _(DONE)_
**Goal:** Run Gemini against uploaded image bytes and produce editable Prompt Essentials.
**Owner:** Codex
**Acceptance:** live Gemini path works; mock mode is labeled dev fallback only.

## S3 - Prompt Personalization

### S3-001 - Workspace-scoped Affiliate Profile _(DONE)_
**Goal:** Affiliate Profile is prompt persona and owns character/environment locks.
**Owner:** Codex
**Acceptance:** profile rules are UI-editable and not hardcoded, profile assets are limited to Character and Environment, and no separate background-reference slot exists.

Legacy note: S3-001 reflects the earlier workspace-scoped phase. The revised top-level persona model is tracked by S3-003.

### S3-002 - Paket Prompt editor/generator _(DONE)_
**Goal:** Build `/prompts` and product detail prompt surface with Prompt Clip 1, Prompt Clip 2, Caption, Tags, Target Marketplace, Instruksi Revisi, and clip-level I2I/I2V fields.
**Owner:** Codex
**Acceptance:** prompt pack JSON persists, includes `prompt_context`, versions are preserved, clip-level first-frame/last-frame/I2V inputs are represented, and the selected Flow-ready version is explicit.

### S3-003 - Top-level Affiliate Profile relation and strict lock semantics _(DONE)_
**Goal:** Move Affiliate Profile to a top-level persona model with explicit workspace links, default selection, and strict character/environment lock behavior.
**Owner:** Codex
**Acceptance:** one profile can link to multiple workspaces, each workspace can mark one default profile link, new profiles default asset locks to ON, save may happen before asset refs exist, and prompt generation blocks when a locked Character or Environment reference is missing.

## S4 - Flow Control and Windows Helper

### S4-001 - Global Flow account pool _(DONE)_
**Goal:** Keep Flow accounts global tools.
**Owner:** Codex
**Acceptance:** `flow_accounts` has no `workspace_id` and no Chrome profile path fields.

### S4-002 - Account recommendation _(DONE)_
**Goal:** Recommend Flow account by status, observed credit, cooldown, and active slot.
**Owner:** Codex
**Acceptance:** user confirms the account before batch execution.

### S4-003 - Flow Control board _(DONE)_
**Goal:** `/controller` shows Prompt Siap, Sedang Flow, Output Masuk, Selesai.
**Owner:** Codex
**Acceptance:** board is desktop-first and uses real statuses, not fake Google Flow progress claims.

### S4-004 - Manifest export _(DONE)_
**Goal:** Generate batch manifest JSON for Windows Helper.
**Owner:** Codex
**Acceptance:** manifest includes batch, account code, Drive folder, helper output key, rename pattern, and jobs.

### S4-005 - Helper metadata callback _(DONE)_
**Goal:** Accept metadata callback from Windows Helper after Drive upload.
**Owner:** Codex
**Acceptance:** callback uses App API Token, writes owner-scoped metadata, and never receives large video bytes.

## S5 - Product Detail and Output Package

### S5-001 - Detail surfaces _(DONE)_
**Goal:** Product detail shows Metadata, Output, and History.
**Owner:** Codex
**Acceptance:** history reads prompt pack versions, Flow batches, clip jobs, and generated files; product detail does not become a second prompt editor.

### S5-002 - Output package _(DONE)_
**Goal:** Show Nama Produk, Keyword Etalase, Caption, Tags, Clip 1, Clip 2, Folder Drive, Status.
**Owner:** Codex
**Acceptance:** output download uses Drive links/folders, not server ZIP.

### S5-003 - Mobile product workflow tabs and skeleton _(DONE)_
**Goal:** Refactor `/products` for mobile-first workflow tabs, `Draf` continue entrypoint, one-badge cards, search, and matching loading skeleton.
**Owner:** Codex
**Acceptance:** tab labels are one word only, `Draf` shows a visible `Lanjutkan` CTA, `Upload` reveals `Shopee`/`TikTok`/`Keduanya` subfilters, search covers product name/code/workspace/marketplace/status context, mobile cards stay compact with one primary badge plus a short context line, and the loading skeleton matches the new tab structure.

### S5-004 - Mobile product status bottom sheet _(DONE)_
**Goal:** Add an overflow action that opens a mobile bottom sheet for status-only manual workflow flags.
**Owner:** Codex
**Acceptance:** overflow exposes `Ubah status`, the sheet uses native switch rows for `Video`, `Shopee`, and `TikTok`, prompt-ready stays derived from prompt packs, no copy UI or duplicate status summary is shown, and no in-app clip upload or big `/products/[id]` refactor is introduced.

## S6 - Pengaturan Hub

### S6-001 - Workspace and affiliate settings _(DONE)_
**Goal:** Use list + drawer CRUD and minimal fields for Ruang Kerja and Akun Affiliate.
**Owner:** Codex
**Acceptance:** workspace drawer hides auto-generated code and uses Nama Ruang Kerja, niche picker, default switch, and archive; affiliate drawer uses base info, Character/Environment image cards, editable rule editors, and no notes field.

### S6-002 - Tool settings _(DONE)_
**Goal:** Keep Gemini, Drive, Flow link/status, Account, and Windows Helper/App API Token in Pengaturan.
**Owner:** Codex
**Acceptance:** Gemini, Drive, Flow link/status, Account, and Windows Helper/App API Token stay in Pengaturan; Drive is folder-centric list + drawer, Account contains Chrome pairing plus token controls, and Flow Accounts remain controller-owned rather than Settings CRUD.

### S6-003 - Picker grammar lock _(DONE)_
**Goal:** Apply the shared picker grammar across all choice fields.
**Owner:** Codex
**Acceptance:** choice fields use the shared custom picker, searchable mode is used only when the option set needs search, desktop panels anchor to the field, and mobile panels become bottom sheets.

### S6-004 - Nested settings routing desktop/mobile _(DONE)_
**Goal:** Split `/settings` into overview plus nested sections so desktop and mobile have clear section routing without adding a second global settings nav.
**Owner:** Codex
**Acceptance:** `/settings` stays overview-first, nested sections exist for Workspace, Affiliate Profiles, Gemini, Drive, Account, and Flow link, desktop gets compact internal section navigation, mobile stays scroll-efficient, and `Pengaturan > Account` remains the only place for Chrome pairing, App API Token, and sign out.

### S6-005 - List drawer table/card grammar _(DONE)_
**Goal:** Apply the locked list + drawer CRUD grammar across mutable master surfaces.
**Owner:** Codex
**Acceptance:** desktop mutable lists use searchable tables plus right side drawers, mobile mutable lists use compact cards plus full-screen drawers or bottom sheets, create entrypoints exist only in header and empty state CTA, row actions are Open plus edit/archive/delete in overflow, and archive-first lifecycle is the default.

### S6-006 - Affiliate Profile drawer rewrite _(DONE)_
**Goal:** Replace the current form-heavy Akun Affiliate surface with the locked list + drawer model and two first-class asset cards.
**Owner:** Codex
**Acceptance:** row summaries stay minimal, the drawer is the only edit surface, Character and Environment each have upload/replace/remove plus preview/status, explicit workspace links and default selection live in the drawer, and notes are not shown in forms.

### S6-007 - Gemini multi-key settings list-card _(DONE)_
**Goal:** Convert `/settings/gemini` into a workspace-style list-card surface with create/edit drawer and disable action.
**Owner:** Codex
**Acceptance:** multiple Gemini keys can be created, listed, edited, and disabled from `/settings/gemini`; the add button matches the workspace pattern without search; and Test, Copy Key, Regenerate, and history UI remain out of scope.

### S6-008 - Affiliate overview avatar quick switch _(DONE)_
**Goal:** Show real affiliate profile avatars in `/settings` overview and allow switching the default profile for the active workspace without opening the detail route.
**Owner:** Codex
**Acceptance:** the overview shows character-image avatars when available, falls back to the environment image or initials, and the quick switch button updates the active workspace default affiliate profile from the list view.

### S6-009 - Google Drive connect row polish _(DONE)_
**Goal:** Move Google Drive connect into the `/settings` overview and retire `/settings/drive` as a visible UI surface while keeping OAuth callback and workspace sync intact.
**Owner:** Codex
**Acceptance:** Google Drive uses a local asset icon, shows `Connect` only when disconnected, `/settings/drive` redirects to `/settings`, OAuth callback returns to `/settings`, and workspace Drive folder provisioning is automatic under `/AffiliateAI/`.

### S6-010 - Gemini usage quota overview _(DONE)_
**Goal:** Show a compact Gemini `RPD`, `RPM`, and `TPM` usage overview at the top of `/settings`.
**Owner:** Codex
**Acceptance:** usage is derived from app-recorded Gemini calls, limits are saved from selected model defaults instead of operator quota fields, counts group by `project + model` when project metadata exists, the UI falls back to per-key grouping when project is empty, the panel keeps a one-line header with no warning/empty copy, each card uses a thick static half-width donut chart with quota numbers beside it, chart tap does not open tooltip/focus framing, and multiple keys render through a swipeable carousel.

### S6-011 - Gemini usage event owner indexes _(DONE)_
**Goal:** Add supporting owner FK indexes for Gemini usage events used by usage aggregation and key/task joins.
**Owner:** Codex
**Acceptance:** `gemini_api_usage_events (gemini_api_key_id, user_id)` and `gemini_api_usage_events (ai_task_id, user_id)` exist through migration-first changes, and the schema lock stays aligned with the actual database indexes.

### S6-012 - Gemini secret and public function hardening _(DONE)_
**Goal:** Deny direct client access to `gemini_api_key_secrets` and remove public EXECUTE from the exposed public helper functions.
**Owner:** Codex
**Acceptance:** `gemini_api_key_secrets` has a restrictive deny-all policy for client roles, `handle_new_auth_user` and `set_updated_at` are not executable by `public`, `anon`, or `authenticated`, and future public functions do not auto-expose through default privileges.

### MT-GEMINI-FREE-TIER-01 - Gemini Free tier model defaults _(DONE)_
**Goal:** Align the Gemini model picker, stored quota defaults, usage calculation, and database constraint with the operator's Google AI Studio Free tier quota snapshot.
**Owner:** Codex
**Acceptance:** picker shows only quota-positive Free tier models, quota defaults match the snapshot, zero-quota models are hidden and not routed for live requests, and legacy zero-quota rows are preserved as disabled metadata.

## S7 - Dashboard Analytics

### S7-001 - Phase awal analytics _(DONE)_
**Goal:** Show Gemini, Drive, prompt, and output/import counts.
**Owner:** Codex
**Acceptance:** counts use Supabase/Drive metadata or are clearly unavailable.

## S8 - Hardening

### S8-001 - Minimal UI copy pass _(DONE)_
**Goal:** Remove verbose descriptions from primary surfaces.
**Owner:** Codex
**Acceptance:** only titles, labels, action labels, status labels, one-sentence empty states, and one-sentence error states remain.

### S8-002 - E2E real-data smoke _(DONE)_
**Goal:** Run dev E2E with real sample images, live Gemini, Drive upload, prompt persistence, Flow manifest, and output metadata callback when helper is available.
**Owner:** Codex + User setup
**Acceptance:** failures are classified as product blocker, helper limitation, auth limitation, or missing external setup.

### S8-003 - Hide codes and remove form notes _(DONE)_
**Goal:** Make all operator-facing code fields internal/auto-generated and remove notes/catatan fields from forms.
**Owner:** Codex
**Acceptance:** no primary UI form asks for codes or notes, codes are still generated for database/helper artifacts, and technical manifest/helper identifiers keep working.

### S8-004 - Prompt surface KPI cleanup _(DONE)_
**Goal:** Remove duplicated KPI tiles from prompt editor and product detail prompt surfaces.
**Owner:** Codex
**Acceptance:** prompt editor and prompt detail keep compact context lines and contract preview, but do not repeat header-level KPI tiles for the same product or prompt pack.

### S8-005 - Mobile Drive selection hardening _(DONE)_
**Goal:** Keep Drive grid long-press selection persistent on mobile and align the shell chrome color used by the PWA.
**Owner:** Codex
**Acceptance:** long-press on Drive commits client-side multi-select and survives release or small pointer movement, tap still opens preview when selection mode is off, the light mobile themeColor uses `#f8fbfd`, and the associated smoke coverage remains stable.

### S8-006 - Global activity feedback and loading progress _(DONE)_
**Goal:** Make long-running actions across the app use the same bottom-native feedback dock, pending banners, and visible progress estimate where the workflow is still loading.
**Owner:** Codex
**Acceptance:** analysis and prompt generation actions surface a shared loading banner with an estimated progress percentage, flash messages appear once in the bottom feedback dock instead of duplicating inline, auth routes keep their own inline banners, and the dock stays clear of the mobile bottom nav.

### S8-007 - OCR evidence hardening _(DONE)_
**Goal:** Make intake Gemini analysis OCR-first and preserve exact per-image marketplace evidence for downstream prompt generation.
**Owner:** Codex
**Acceptance:** Gemini intake schema requires versioned OCR diagnostics, parser preserves exact OCR fields and review flags, marketplace source rows use Shopee/TikTok-specific evidence, prompt pack parsing rejects source product/status mismatches, and no link-only visual parsing is claimed.
