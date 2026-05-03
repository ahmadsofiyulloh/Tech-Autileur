# Micro Task Backlog - Phase Awal MVP

This backlog replaces older sprint assumptions. Implement one micro-task at a time.

## Progress Snapshot

Completed on this branch:

- S0-001
- S1-001, S1-002, S1-003
- S2-001, S2-003
- S3-001, S3-002
- S4-001, S4-002, S4-003
- S5-001, S5-002
- S6-001, S6-002, S6-004, S6-005
- S7-001

## S0 - Docs and Source of Truth Sync

### S0-001 - Align Phase awal lock docs _(DONE)_
**Goal:** Make PRD, architecture, schema, Flow, mobile, prompt, Drive, and acceptance docs describe the same app flow.
**Owner:** Codex
**Acceptance:** no doc treats Flow accounts as workspace-bound, mobile Flow Control as primary, duplicate Settings entry points as acceptable, or verbose UI copy as allowed.

## S1 - Navigation and Route Lock

### S1-001 - Lock desktop and mobile nav _(DONE)_
**Goal:** Desktop sidebar is Dashboard, Produk, Prompt, Flow Control, Pengaturan. Mobile bottom nav is Dashboard, Produk, Prompt, Pengaturan.
**Owner:** Codex
**Acceptance:** `/controller` is hidden from mobile nav, direct mobile access shows a desktop-required state, and the topbar does not duplicate Settings.

### S1-002 - Route compatibility _(DONE)_
**Goal:** Keep `/intake`, `/flow`, and `/outputs` compatibility behavior without creating duplicate primary funnels.
**Owner:** Codex
**Acceptance:** `/products/new`, `/prompts`, `/controller`, and product detail remain the locked working surfaces.

### S1-003 - Shell settings and account lock _(DONE)_
**Goal:** Move Sign out and Chrome profile pairing into `Pengaturan > Account`, with no duplicate shell settings entry points.
**Owner:** Codex
**Acceptance:** Settings remains the only configuration hub, Sign out is not in the header, and Chrome profile pairing includes Buat, Salin, Unduh JSON, and Lepas Pairing.

## S2 - Intake Workflow

### S2-001 - Upload-only intake before Gemini _(DONE)_
**Goal:** `/products/new` requires `Foto Produk Utama`, `Screenshot Shopee`, and `Screenshot TikTok` upload cards before analysis.
**Owner:** Codex
**Acceptance:** no title/account/metadata fields are shown before `Analisis Gemini`.

### S2-002 - Real Drive upload
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

### S3-002 - Paket Prompt editor/generator _(DONE)_
**Goal:** Build `/prompts` and product detail prompt surface with Prompt Clip 1, Prompt Clip 2, Caption, Tags, Target Marketplace, Instruksi Revisi, and clip-level I2I/I2V fields.
**Owner:** Codex
**Acceptance:** prompt pack JSON persists, includes `prompt_context`, versions are preserved, clip-level first-frame/last-frame/I2V inputs are represented, and the selected Flow-ready version is explicit.

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

### S4-004 - Manifest export
**Goal:** Generate batch manifest JSON for Windows Helper.
**Owner:** Codex
**Acceptance:** manifest includes batch, account code, Drive folder, helper output key, rename pattern, and jobs.

### S4-005 - Helper metadata callback
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
**Acceptance:** workspace drawer uses auto-generated code, Nama Ruang Kerja, niche picker, Folder Drive Utama picker, default switch, and archive; affiliate drawer uses base info, Character/Environment image cards, editable rule editors, and no required notes field.

### S6-002 - Tool settings _(DONE)_
**Goal:** Keep Gemini, Drive, Flow link/status, Account, and Windows Helper/App API Token in Pengaturan.
**Owner:** Codex
**Acceptance:** Gemini is a single form surface, Drive is folder-centric list + drawer, Account contains Chrome pairing plus token controls, and Flow Accounts remain controller-owned rather than Settings CRUD.

### S6-003 - Picker and typography lock
**Goal:** Apply custom picker grammar and lock the compact type hierarchy.
**Owner:** Codex
**Acceptance:** relational fields use custom picker behavior, loose text fields can use static suggestions with free fallback, and the locked type hierarchy is documented.

### S6-004 - Nested settings routing desktop/mobile _(DONE)_
**Goal:** Split `/settings` into overview plus nested sections so desktop and mobile have clear section routing without adding a second global settings nav.
**Owner:** Codex
**Acceptance:** `/settings` stays overview-first, nested sections exist for Workspace, Affiliate Profiles, Gemini, Drive, Account, and Flow link, desktop gets compact internal section navigation, mobile stays scroll-efficient, and `Pengaturan > Account` remains the only place for Chrome pairing, App API Token, and sign out.

### S6-005 - List drawer table/card grammar _(DONE)_
**Goal:** Apply the locked list + drawer CRUD grammar across mutable master surfaces.
**Owner:** Codex
**Acceptance:** desktop mutable lists use searchable tables plus right side drawers, mobile mutable lists use compact cards plus full-screen drawers or bottom sheets, create entrypoints exist only in header and empty state CTA, row actions are Open plus edit/archive/delete in overflow, and archive-first lifecycle is the default.

## S7 - Dashboard Analytics

### S7-001 - Phase awal analytics _(DONE)_
**Goal:** Show Gemini, Drive, prompt, and output/import counts.
**Owner:** Codex
**Acceptance:** counts use Supabase/Drive metadata or are clearly unavailable.

## S8 - Hardening

### S8-001 - Minimal UI copy pass
**Goal:** Remove verbose descriptions from primary surfaces.
**Owner:** Codex
**Acceptance:** only titles, labels, action labels, status labels, one-sentence empty states, and one-sentence error states remain.

### S8-002 - E2E real-data smoke
**Goal:** Run dev E2E with real sample images, live Gemini, Drive upload, prompt persistence, Flow manifest, and output metadata callback when helper is available.
**Owner:** Codex + User setup
**Acceptance:** failures are classified as product blocker, helper limitation, auth limitation, or missing external setup.
