# Micro Task Backlog - Phase Awal MVP

This backlog replaces older sprint assumptions. Implement one micro-task at a time.

## S0 - Docs and Source of Truth Sync

### S0-001 - Align Phase awal lock docs
**Goal:** Make PRD, architecture, schema, Flow, mobile, prompt, Drive, and acceptance docs describe the same app flow.
**Owner:** Codex
**Acceptance:** no doc treats Flow accounts as workspace-bound, mobile Flow Control as primary, duplicate Settings entry points as acceptable, or verbose UI copy as allowed.

## S1 - Navigation and Route Lock

### S1-001 - Lock desktop and mobile nav
**Goal:** Desktop sidebar is Dashboard, Produk, Prompt, Flow Control, Pengaturan. Mobile bottom nav is Dashboard, Produk, Prompt, Pengaturan.
**Owner:** Codex
**Acceptance:** `/controller` is hidden from mobile nav, direct mobile access shows a desktop-required state, and the topbar does not duplicate Settings.

### S1-002 - Route compatibility
**Goal:** Keep `/intake`, `/flow`, and `/outputs` compatibility behavior without creating duplicate primary funnels.
**Owner:** Codex
**Acceptance:** `/products/new`, `/prompts`, `/controller`, and product detail remain the locked working surfaces.

### S1-003 - Shell settings and account lock
**Goal:** Move Sign out and Chrome profile pairing into `Pengaturan > Account`, with no duplicate shell settings entry points.
**Owner:** Codex
**Acceptance:** Settings remains the only configuration hub, Sign out is not in the header, and Chrome profile pairing includes Buat, Salin, Unduh JSON, and Lepas Pairing.

## S2 - Intake Workflow

### S2-001 - Upload-only intake before Gemini
**Goal:** `/products/new` requires `Foto Produk Utama` and `Screenshot Marketplace` uploads before analysis.
**Owner:** Codex
**Acceptance:** no title/account/metadata fields are shown before `Analisis Gemini`.

### S2-002 - Real Drive upload
**Goal:** Store uploaded image/screenshot bytes in Google Drive and metadata in Supabase.
**Owner:** Codex
**Acceptance:** real sample files can be uploaded in dev E2E without mock-only storage.

### S2-003 - Live Gemini metadata analysis
**Goal:** Run Gemini against uploaded image bytes and produce editable Prompt Essentials.
**Owner:** Codex
**Acceptance:** live Gemini path works; mock mode is labeled dev fallback only.

## S3 - Prompt Personalization

### S3-001 - Workspace-scoped Affiliate Profile
**Goal:** Affiliate Profile is prompt persona and owns character/environment locks.
**Owner:** Codex
**Acceptance:** profile rules are UI-editable and not hardcoded, profile assets are limited to Character and Environment, and no separate background-reference slot exists.

### S3-002 - Paket Prompt editor/generator
**Goal:** Build `/prompts` and product detail prompt surface with Prompt Clip 1, Prompt Clip 2, Caption, Tags, Target Marketplace, Instruksi Revisi, and clip-level I2I/I2V fields.
**Owner:** Codex
**Acceptance:** prompt pack JSON persists, includes `prompt_context`, versions are preserved, clip-level first-frame/last-frame/I2V inputs are represented, and the selected Flow-ready version is explicit.

## S4 - Flow Control and Windows Helper

### S4-001 - Global Flow account pool
**Goal:** Keep Flow accounts global tools.
**Owner:** Codex
**Acceptance:** `flow_accounts` has no `workspace_id` and no Chrome profile path fields.

### S4-002 - Account recommendation
**Goal:** Recommend Flow account by status, observed credit, cooldown, and active slot.
**Owner:** Codex
**Acceptance:** user confirms the account before batch execution.

### S4-003 - Flow Control board
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

### S5-001 - Detail surfaces
**Goal:** Product detail shows Metadata, Paket Prompt, Output, and History.
**Owner:** Codex
**Acceptance:** history reads prompt pack versions, Flow batches, clip jobs, and generated files.

### S5-002 - Output package
**Goal:** Show Nama Produk, Keyword Etalase, Caption, Tags, Clip 1, Clip 2, Folder Drive, Status.
**Owner:** Codex
**Acceptance:** output download uses Drive links/folders, not server ZIP.

## S6 - Pengaturan Hub

### S6-001 - Workspace and affiliate settings
**Goal:** Use minimal fields for Ruang Kerja and Akun Affiliate.
**Owner:** Codex
**Acceptance:** workspace labels are Nama Ruang Kerja and Folder Drive Utama, and the settings hub is overview-first.

### S6-002 - Tool settings
**Goal:** Keep Gemini, Drive, Flow Accounts, and Windows Helper/App API Token in Pengaturan.
**Owner:** Codex
**Acceptance:** Flow account form starts with Kode Akun and Tipe Akun only, Gemini is a single form surface, Drive is folder-centric, and Account contains Chrome pairing plus token controls.

### S6-003 - Picker and typography lock
**Goal:** Replace raw browser dropdown assumptions with custom pickers and lock the compact type hierarchy.
**Owner:** Codex
**Acceptance:** relational fields use custom picker behavior, loose text fields can use static suggestions with free fallback, and the locked type hierarchy is documented.

## S7 - Dashboard Analytics

### S7-001 - Phase awal analytics
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
