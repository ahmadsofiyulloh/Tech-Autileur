# Micro Task Backlog - Phase Awal MVP

This backlog replaces older sprint assumptions. Implement one micro-task at a time.

## Progress Snapshot

Completed on this branch, audit-backed via `docs/BACKLOG_AUDIT.md`:

- S0-001
- S1-001, S1-002, S1-003
- S2-001, S2-002, S2-003
- S3-001, S3-002, S3-003
- S4-001, S4-002, S4-003, S4-004, S4-005
- S5-001, S5-002
- S6-001, S6-002, S6-003, S6-004, S6-005, S6-006, S6-007
- S7-001
- S8-001, S8-002, S8-003, S8-004
- VIS-001, VIS-002, VIS-003, VIS-004, VIS-005, VIS-006

## S0 - Docs and Source of Truth Sync

### S0-001 - Align Phase awal lock docs _(DONE)_
**Goal:** Make PRD, architecture, schema, Flow, mobile, prompt, Drive, and acceptance docs describe the same app flow.
**Owner:** Codex
**Acceptance:** no doc treats Flow accounts as workspace-bound, mobile Flow Control as primary, duplicate Settings entry points as acceptable, or verbose UI copy as allowed.

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
- Drive thumbnails use available metadata/URL and fall back to icons/placeholders.
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
**Goal:** `/products/new` requires `Foto Produk Utama`, `Screenshot Shopee`, and `Screenshot TikTok` upload cards before analysis.
**Owner:** Codex
**Acceptance:** no title/account/metadata fields are shown before `Analisis Gemini`.

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

## S6 - Pengaturan Hub

### S6-001 - Workspace and affiliate settings _(DONE)_
**Goal:** Use list + drawer CRUD and minimal fields for Ruang Kerja and Akun Affiliate.
**Owner:** Codex
**Acceptance:** workspace drawer hides auto-generated code and uses Nama Ruang Kerja, niche picker, Folder Drive Utama picker, default switch, and archive; affiliate drawer uses base info, Character/Environment image cards, editable rule editors, and no notes field.

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
