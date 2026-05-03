# MVP Acceptance Criteria

## Core System

- User can log in with Supabase Auth.
- User sees a protected dashboard.
- Desktop sidebar is exactly `Dashboard`, `Produk`, `Prompt`, `Flow Control`, `Pengaturan`.
- Mobile bottom nav is exactly `Dashboard`, `Produk`, `Prompt`, `Pengaturan`.
- `/controller` is hidden from mobile bottom nav.
- Topbar does not duplicate a Settings button or second settings entry point.
- Compatibility routes keep working without becoming primary duplicate funnels.
- Metadata is stored in Supabase.
- File bytes and asset folders are stored in Google Drive.
- RLS prevents cross-user access.

## Products and Intake

- `/products` shows the product list only.
- `/products/new` is the intake workflow entrypoint.
- `/products/[id]` shows `Metadata`, `Output`, and `History`.
- Intake uses upload cards with local preview.
- Intake requires at least 1 `Foto Produk Utama`, 1 `Screenshot Shopee`, and 1 `Screenshot TikTok`.
- No product title/account/metadata field is required before Gemini analysis.
- `Analisis Gemini` runs against uploaded image bytes for real E2E.
- If image bytes are missing, the app does not claim visual parsing.
- Intake inherits `current_workspace_id` when one is active.
- Loading, empty, and error states exist on tested intake surfaces.

## Metadata Review

- Gemini output is reviewable and editable.
- Required review fields are `Nama Produk`, `Keyword Cari Etalase`, `Deskripsi Visual`, `Use Case`, `Pain Point`, `Selling Angle`, `Target Viewer`.

## Prompt Pipeline

- Prompt surface label is `Paket Prompt`.
- Required fields exist: `Prompt Clip 1`, `Prompt Clip 2`, `Caption`, `Tags`, `Target Marketplace`, `Instruksi Revisi`.
- Each clip panel exposes `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt`.
- Required actions exist: `Buat Prompt`, `Buat Ulang`, `Tandai Siap Flow`.
- Prompt generation consumes the selected or workspace-default-linked Affiliate Profile and product context.
- Character and environment locks come from Affiliate Profile only in Phase awal.
- Prompt generation blocks when a locked Character or Environment reference is missing.
- There is no separate background-reference profile asset in Phase awal.
- Prompt rules are editable in UI and not hardcoded in JSX/HTML/route handlers.
- Prompt packs are stored as structured JSON.
- `prompt_context` persists in `prompt_packs.personalization_json`.
- Prompt pack versions are preserved.

## Flow Control and Flow Accounts

- `/controller` is the desktop-only Flow Control board.
- Board columns are `Prompt Siap`, `Sedang Flow`, `Output Masuk`, `Selesai`.
- Flow accounts remain global execution tools.
- Flow accounts do not have `workspace_id`.
- Flow accounts do not store Chrome profile paths.
- Any workspace, product, or prompt can use any available Flow account.
- Flow account count is dynamic and never hardcoded.
- Account recommendation uses status, observed credit, cooldown, and available slot.
- User confirms the selected account.
- No browser automation or Google Flow auto-run exists.
- No UI claims automatic Google Flow progress unless helper/extension data reports it.
- Windows Helper pairing and Chrome profile controls live in `Pengaturan > Account`, not in `/controller`.
- Chrome pairing actions are `Buat`, `Salin`, `Unduh JSON`, and `Lepas Pairing`.

## Windows Helper

- App can produce a batch manifest JSON.
- Manifest includes batch code, Flow account code, Drive output folder, helper output folder key, rename pattern, and jobs.
- Helper local config owns Chrome profile path mapping.
- Helper local config owns local output folder path mapping.
- App API Token authenticates helper metadata callback.
- App stores token hash only.
- Helper callback writes owner-scoped metadata.
- Helper callback does not upload large video bytes through the app.

## Output Package

- Output package shows `Nama Produk`, `Keyword Etalase`, `Caption`, `Tags`, `Clip 1`, `Clip 2`, `Folder Drive`, `Status`.
- Clip statuses include `Belum Ada`, `Imported`, `Approved`.
- Output links point to Google Drive.
- No server ZIP generation is required in Phase awal.

## Affiliate Profiles and Settings

- User can create unlimited affiliate profiles.
- Profiles are top-level personas linked to one or more workspaces.
- Profiles store editable prompt personalization rules.
- Profiles can lock character and environment with Drive references.
- Profile UI exposes only two asset slots: Character and Environment.
- No third background-reference asset slot exists in MVP.
- Default profile selection is explicit per workspace.
- New profiles default asset locks to ON.
- Workspace settings use `Nama Ruang Kerja` and `Folder Drive Utama`.
- Workspace settings use list + drawer CRUD with hidden auto-generated code, name, niche picker, Drive root picker, default switch, and archive.
- Affiliate Profile settings use list + drawer CRUD with base info, Character image card, Environment image card, rule editors, archive, and explicit workspace links/default selection.
- Affiliate Profile settings do not show `notes` fields.
- Gemini settings are a single minimal form surface, not list/history.
- Drive settings are folder-centric list + drawer, workspace-scoped, and folders only.
- Flow Accounts are controller-owned execution tools and do not become a separate Settings CRUD surface.
- Chrome profile pairing and App API Token controls live in `Pengaturan > Account`.

## Dashboard Analytics

- Dashboard can show Gemini task counts.
- Dashboard can show token/cost estimate when available.
- Dashboard can show generated file count.
- Dashboard can show Drive item count.
- Dashboard can show prompt pack count.
- Dashboard can show output/import status counts.

## UI Copy

- Primary surfaces use Indonesian operational labels.
- Verbose page descriptions are absent.
- Empty states use at most one short sentence.
- Error states use at most one short sentence.
- Overview pages may use a short summary line, but operational pages do not.
- Duplicate Settings entry points do not exist across the shell.
- The UI uses Geist Sans as the base type family.
- Graphite Gold styling remains a compact dark workbench, not a marketing theme.
- Choice fields use shared custom picker behavior rather than raw browser dropdowns.
- The compact type hierarchy is documented and followed on mobile and desktop.
- Desktop mutable master lists use searchable tables plus right side drawers.
- Mobile mutable master lists use compact cards plus full-screen drawers or bottom sheets.
- Create entrypoints appear only in page header and empty state CTA.
- Row actions are `Open` plus edit/archive/delete in overflow.
- Archive-first lifecycle is used for mutable master data.

## Hardening

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `git diff --check` passes.
- No real secrets are committed.
- Post-MVP features are not implemented.
