# PRD v1 Final - Affiliate AI Content OS MVP

**Status:** LOCKED FOR MVP IMPLEMENTATION
**Version:** 1.1 Phase Awal Lock
**Date:** 2026-05-02
**Primary Operator:** Single owner/operator
**Implementation Target:** Next.js PWA + Supabase + Google Drive + Gemini API + Google Flow workflow + Windows Helper
**Implementation Mode:** Codex CLI with strict source-of-truth docs and Git checkpoints

## 0. Executive Summary

Affiliate AI Content OS is a private operator tool for AI affiliate content production. It manages product intake, prompt personalization, Google Flow manual execution, Drive-based asset metadata, output packages, and dashboard usage status from one control plane.

This MVP is an AI production control center. It is not a video editor, not an auto-uploader to TikTok/Shopee, and not a browser automation system.

## 1. Locked App Flow and UX

### 1.1 Main Navigation

Desktop sidebar labels are exactly:

```text
Dashboard
Produk
Prompt
Flow Control
Pengaturan
```

Mobile bottom navigation labels are exactly:

```text
Dashboard
Produk
Prompt
Pengaturan
```

`Flow Control` is desktop-only and must not appear in mobile bottom navigation.

### 1.2 Route Lock

```text
/products       -> Produk list
/products/new   -> mobile-first intake workflow
/products/[id]  -> product detail with Metadata, Paket Prompt, Output, History
/prompts        -> Paket Prompt working surface and compatibility manager
/controller     -> desktop-only Flow Control board
/settings       -> Pengaturan hub
```

The topbar must not duplicate a Settings button or any second settings entry point. Topbar may show the route title and contextual actions only.

Compatibility routes remain available, but are not primary surfaces:

```text
/intake   -> /products/new
/flow     -> /controller
/outputs  -> compatibility/archive view only
/gemini   -> primarily accessed from Pengaturan
/drive    -> primarily accessed from Pengaturan
```

When `/controller` is opened on mobile, the app should show a minimal desktop-required state instead of a mobile queue surface.

`Sign out` must live only in `Pengaturan > Account`.

### 1.3 Required Step Order

```text
Mobile intake upload
-> Analisis Gemini
-> Metadata review
-> Paket Prompt preview/edit/regenerate
-> Tandai Siap Flow
-> Desktop Flow Control
-> Windows Helper opens Chrome profile + Flow URL
-> User runs Google Flow manually
-> Helper renames/uploads outputs to Drive
-> Output package/history
```

### 1.4 Intake UX

Before Gemini analysis, intake is upload-only.

Required uploads:

- `Foto Produk Utama`: at least 1 product image.
- `Screenshot Marketplace`: at least 1 marketplace screenshot.

Optional uploads:

- additional product images.
- additional marketplace screenshots.

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
Catatan Risiko
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

Affiliate Profile is workspace-scoped and acts as the prompt persona.

Profile-owned locks only:

- character lock.
- environment lock.
- caption/tag style.
- negative prompt rules.

Character and environment are the only profile-owned image assets in Phase awal. The environment asset is the background-lock asset for prompt generation.

There is no separate background-reference asset slot in MVP. Prompt pages must not create per-prompt overrides for character or environment locks in Phase awal. The prompt page may show which profile is active, but the source of personalization remains the Affiliate Profile.

Prompt generation must always consume the active workspace, active affiliate profile, the profile character/environment Drive references, and the reviewed Gemini metadata for that workspace.

The default workspace supplies the default affiliate profile when one is configured.

### 1.8 Flow Control UX

`/controller` is the desktop-only Flow Control board.

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

Dashboard is the operator entrypoint. Phase awal analytics priority:

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
- Flow Accounts.
- Windows Helper / App API Token.
- Account/logout.

`/settings` is overview-first. The hub must surface cards or sections for Workspace, Affiliate Profiles, Gemini, Drive, Account, and Flow link in a single minimal configuration surface. It must not create a second navigation system.

`Pengaturan > Account` owns Chrome profile pairing, App API Token, and sign out. Chrome pairing actions are `Buat`, `Salin`, `Unduh JSON`, and `Lepas Pairing`.

`/controller` helper actions are `Buka Profil`, `Buka Flow`, and `Ekspor Manifest`. Pairing controls do not live there.

Workspace field labels are minimal:

```text
Nama Ruang Kerja
Folder Drive Utama
```

Flow Account form is minimal:

```text
Kode Akun
Tipe Akun
```

The app may keep advanced Flow account defaults hidden unless needed.

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

- neutral dark workbench styling.
- compact operational spacing.
- no oversized hero blocks on functional pages.
- 8px radius or less for cards and framed surfaces unless a component already has a stronger local rule.
- Inter as the base typography.
- clear type hierarchy with page title above section title above card title above label/body.
- no duplicate settings affordances in topbar, header, and sidebar at the same time.
- custom picker for relational fields instead of raw browser dropdowns.
- static suggestions with free fallback for non-relational text fields that still need loose input.
- loading, empty, and error states on every active surface.

Recommended hierarchy:

```text
Page title: 28/34
Section title: 20/28
Card title: 16/24
Label: 12/16
Body: 14/20
```

## 2. Product Vision

1. Reduce manual work in intake and prompt preparation.
2. Keep images, screenshots, prompts, Flow assignments, and outputs organized by product and workspace.
3. Keep Flow accounts global execution tools, not workspace-bound.
4. Allow unlimited workspace-scoped affiliate profiles with editable prompt rules.
5. Use mobile for upload/review/prompt work and desktop for Flow execution.
6. Keep Supabase as metadata source of truth and Google Drive as asset source of truth.

## 3. MVP Definition

MVP means the system can:

- Log in through Supabase Auth.
- Create a workspace and store its Drive root folder metadata.
- Create a workspace-scoped affiliate profile.
- Upload real product images and marketplace screenshots to Google Drive.
- Run live Gemini analysis from uploaded image bytes.
- Review and edit generated product metadata.
- Generate, edit, regenerate, persist, and version prompt packs.
- Mark prompt packs ready for Flow.
- Assign ready prompt packs to global Flow accounts based on status, credit, and availability.
- Export/download a batch manifest for Windows Helper.
- Use Windows Helper to open the correct Chrome profile and Google Flow URL.
- Let the operator run Google Flow manually.
- Let Windows Helper rename/upload generated clips to Google Drive and post metadata back to the app.
- Review output package links and history in the app.
- Show dashboard counts for Gemini, Drive, prompts, and outputs.

## 4. Locked Architecture

### 4.1 Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI: mobile-first for intake/prompt, desktop-first for Flow Control
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
Windows Helper opens Chrome profile + Flow URL and imports outputs
Google Flow generation remains manual
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

### 4.8 Mobile Control

Mobile is for upload, review, prompt, and monitoring. Desktop is required for Flow Control and Google Flow execution.

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
| Flow execution | Google Flow manual execution + Flow Control manifest |
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

## 7. Final MVP Lock Statement

```text
Affiliate AI Content OS MVP is a private AI production control center.

It manages mobile product intake, Gemini metadata extraction, affiliate-profile prompt personalization, prompt pack versioning, desktop Flow Control, Windows Helper-assisted Google Flow handoff/output import, Drive-based asset metadata, output packages, and dashboard counts.

It does not generate videos internally, edit videos, auto-click Google Flow, auto-upload to TikTok/Shopee, or build a custom remote desktop engine.
```
