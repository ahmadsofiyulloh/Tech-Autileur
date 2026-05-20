# MVP Acceptance Criteria

## Core System

- User can log in with Supabase Auth.
- User sees a protected dashboard.
- Workflow navigation is exactly `Intake`, `Produk`, `Prompt`, `Drive`.
- Mobile bottom nav is exactly `Dashboard`, `Intake`, `Produk`, `Prompt`, `Drive`.
- `Dashboard` is the secondary analytics route in the shell nav.
- `/controller` is hidden from mobile bottom nav.
- Topbar shows two distinct global controls: Notifications and Profile avatar menu.
- The Profile avatar menu opens profile overview and includes `Pengaturan` and `Sign out` actions.
- `/settings` has no duplicate standalone Settings gear/action.
- The global shell does not show a workspace picker.
- Compatibility routes keep working without becoming primary duplicate funnels.
- Metadata is stored in Supabase.
- File bytes and asset folders are stored in Google Drive.
- The PWA manifest exposes install metadata (`start_url`, icons, screenshots), and install affordance appears only when the browser offers it.
- RLS prevents cross-user access.

## Products and Intake

- `/products` shows the product list only.
- `/products/new` is the intake workflow entrypoint.
- `/products/[id]` shows `Metadata`, `Output`, and `History`.
- Intake uses upload cards with local preview.
- Intake can save a durable `DRAFT` product with at least 1 `Foto Produk Utama`.
- Intake requires at least 1 `Foto Produk Utama` and at least 1 screenshot from `Screenshot Shopee` or `Screenshot TikTok` before `Analisis Metadata`.
- No product title/account/metadata field is required before metadata analysis.
- `Simpan Produk` and `Analisis Metadata` are separate actions.
- Metadata readiness is not inferred from `products.status`.
- Gemini metadata failure keeps the saved product visible and retryable.
- `Analisis Metadata` runs against uploaded image bytes for real E2E.
- If image bytes are missing, the app does not claim visual parsing.
- Intake inherits `current_workspace_id` when one is active.
- Intake shows the active Affiliate Account context without a profile-switching carousel.
- Intake preview uses three equal mini cards for product, Shopee, and TikTok evidence on mobile.
- Loading, empty, and error states exist on tested intake surfaces.

## Metadata Review

- Gemini output is reviewable and editable.
- Required review fields are `Nama Produk`, `Keyword Cari Etalase`, `Deskripsi Visual`, `Use Case`, `Pain Point`, `Selling Angle`, `Target Viewer`.

## Prompt Pipeline

- Prompt surface label is `Paket Prompt`.
- Required fields exist: `Prompt Clip 1`, `Prompt Clip 2`, `Caption`, `Tags`, `Target Marketplace`, `Instruksi Revisi`.
- Each clip panel exposes `First Frame Image` and `I2V Prompt`; hidden `I2I Last Frame` remains persisted for legacy compatibility.
- Generated prompt fields are read-only, copy-ready, and grouped by collapsible clip section.
- Required actions exist: `Buat Prompt` and `Buat Ulang`.
- Prompt list row action for existing prompts opens `History`; prompt detail opens the generated output/editor route.
- Prompt generation consumes the active Affiliate Profile and product context.
- Character and environment locks come from Affiliate Profile only in Phase awal.
- Prompt generation blocks when a locked Character or Environment reference is missing.
- There is no separate background-reference profile asset in Phase awal.
- Prompt rules are editable in UI and not hardcoded in JSX/HTML/route handlers.
- Prompt packs are stored as structured JSON.
- `prompt_context` persists in `prompt_packs.personalization_json`.
- Prompt pack versions are preserved.
- `GENERATED` is the Phase 1 final operator-facing prompt status.

## Flow Control and Flow Accounts

- `/controller` is frozen in Phase 1 and redirects to `/products/new`.
- The retained Flow Control status buckets are `Prompt Siap`, `Sedang Flow`, `Output Masuk`, `Selesai`.
- The status buckets are compatibility language only; `/controller` must not use a four-grid board as the final desktop production UX.
- Flow accounts remain global execution tools.
- Flow accounts do not have `workspace_id`.
- Flow accounts do not store Chrome profile paths.
- Chrome profile paths are never stored in Supabase, including `flow_accounts`, `flow_batches`, pairing metadata, helper callbacks, logs, or manifest JSON.
- Any workspace, product, or prompt can use any available Flow account.
- Flow account count is dynamic and never hardcoded.
- Account recommendation uses status, observed credit, cooldown, and available slot.
- Flow account availability in `/controller` is labeled as estimated until helper verification exists.
- Flow account lane availability in the controller is estimated accounting state only until the helper returns `Helper verified`.
- Real Chrome profile binding is clearly labeled unavailable until implemented.
- App-visible lane states are `Not paired`, `Lane key set`, `Helper verified`, `Session expired`, and `Unavailable`.
- Chrome profile paths stay local to helper config; Supabase may store lane keys only.
- User confirms the selected account.
- No browser automation or Google Flow auto-run exists.
- No UI claims automatic Google Flow progress unless helper/extension data reports it.
- Windows Helper pairing and Chrome profile controls live in `Pengaturan > Account`, not in `/controller`.
- Chrome pairing actions are `Buat`, `Salin`, `Unduh JSON`, and `Lepas Pairing`.

## Desktop Batch Production

- `/controller` only shows prompt packs, products, batches, clip jobs, and generated files connected to the active workspace.
- `/controller` only shows active workspace prompt-ready items and active workspace batches.
- Prompt Ready rows are never mixed across workspaces in the controller.
- Batches from inactive workspaces are hidden from the active `/controller` production workflow.
- Controlled multi-select batch creation only uses active workspace `Prompt Ready` rows, defaults to a 25-row selection cap, and hard caps at 50.
- Rows with open batches are skipped with a visible skipped count and per-row reasons.
- Batch creation uses the available Flow account pool only, never silently binds an unavailable Flow account, keeps Flow accounts global, and leaves manifest export as a separate step.
- The desktop controller target UX is one horizontal stepped workflow with exactly these steps: `Prompt Ready`, `Batch Setup`, `Manifest Export`, `Helper Prep`, `Manual Flow Run`, `Output Import`, `Reconcile / Close`.
- The current stage is always visible.
- Each step has its own content area.
- The primary desktop layout is not a four-lane grid.
- A four-grid board may remain only as legacy/status compatibility during transition; it is not accepted as the final production UX.
- Batch creation supports selected prompt packs from the active workspace.
- Batch creation refuses prompt packs from inactive workspaces.
- Batch creation refuses already-open prompt packs.
- Manifest export is blocked if `jobs[]` is empty.
- Manifest export is blocked if `stage_jobs[]` is empty.
- Manifest export is blocked if any `prompt_copy_text` is empty after trimming.
- Manifest export is blocked if the `FIRST_FRAME` / `LAST_FRAME` / `VIDEO` dependency contract is invalid.
- Manifest export is blocked if any `depends_on_job_codes` value references a job outside the same manifest.
- Manifest export is blocked if a `LAST_FRAME` stage does not depend on the matching `FIRST_FRAME`.
- Manifest export is blocked if a `VIDEO` stage does not depend on the matching `FIRST_FRAME` and `LAST_FRAME`.
- Manifest export is blocked if any stage uses input handles outside the approved stage contract.
- Manifest export is blocked if `prompt_file_name` or `output_file_name` is unsafe.
- Unsafe filenames include empty names, absolute paths, parent traversal, drive-letter paths, path separators outside the allowed relative file name contract, control characters, or names that cannot be safely created inside the helper working folder.

## Flow Helper Reconciliation

- Helper callback with `stage = FIRST_FRAME` or `stage = LAST_FRAME` maps matched image outputs toward `Image Generated`.
- `Image Generated` is shown only after all required `FIRST_FRAME` and `LAST_FRAME` outputs for the relevant clip/batch are imported and matched.
- Helper callback with `stage = VIDEO` maps matched video outputs toward `Video Generated`.
- `Video Generated` is shown only after required `VIDEO` outputs are imported and matched.
- `Ready Upload` is shown only after the complete final package is available, matched, and linked through Drive/output metadata.
- Ambiguous helper files, unmatched filenames, duplicate possible matches, or missing stage context map to `Needs Manual Match`.
- Helper callback contract errors, missing required Drive metadata, invalid stage values, and failed reconciliation map to `Error`.
- The app does not mark output production-ready from helper upload alone; reconciliation against manifest, stage, clip, batch, and Drive metadata is required.

## Windows Helper

- App can produce a batch manifest JSON.
- Manifest includes batch code, Flow account code, Drive output folder, helper output folder key, rename pattern, and jobs.
- Manifest includes non-empty `jobs[]` and non-empty `stage_jobs[]` before export succeeds.
- Manifest stage prompt files have non-empty `prompt_copy_text`.
- Manifest filenames are validated before helper prep.
- `chrome_profile_lane_key` is an app-visible label only; the local helper resolves it to a Chrome profile path.
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
- Profiles are top-level personas, each owning one internal workspace namespace.
- Profiles store editable prompt personalization rules.
- Profiles can lock character and environment with Drive references.
- Profile UI exposes only two asset slots: Character and Environment.
- No third background-reference asset slot exists in MVP.
- Active profile selection is explicit from Settings overview and switches the internal workspace namespace.
- New profiles default asset locks to ON.
- Workspace settings use `Nama Ruang Kerja` for retained internal support.
- Workspace settings use list + drawer CRUD with hidden auto-generated code, name, niche picker, default switch, and archive.
- Affiliate Profile settings use list + drawer CRUD with base info, Character image card, Environment image card, rule editors, archive, and explicit workspace links/default selection.
- Affiliate Profile settings do not show `notes` fields.
- Affiliate Profile drawer keeps Character preview hidden when `Lock Character` is OFF.
- Affiliate Profile drawer keeps Environment preview hidden when `Lock Environment` is OFF.
- Affiliate Profile reanalysis shows inline pending/success/failure feedback and does not auto-close the drawer on success.
- Gemini settings expose a multi-key list-card CRUD surface with a workspace-style add button, no search, and create/edit/disable only.
- Gemini settings do not expose editable quota fields; `RPM`, `RPD`, and `TPM` are saved from the selected model.
- `/settings` shows compact Gemini usage versus quota using app-recorded calls, grouped by `project + model` when project metadata exists.
- Multiple Gemini keys render in the usage overview with a carousel.
- Google Drive settings are connect/status only; folder provisioning is automatic under `/AffiliateAI/`.
- Flow Accounts are controller-owned execution tools and do not become a separate Settings CRUD surface.
- Chrome profile pairing and App API Token controls live in `Pengaturan > Account`.
- `/settings` overview uses a grouped native-style list.
- Settings groups cover Account, Affiliate Profiles, and Connected Services when backed by real data.

## Drive Visual Manager

- `/drive` is a touch-friendly grid/gallery, not a table-first surface.
- Image-like Drive items show a thumbnail/preview when Drive image bytes can be resolved server-side.
- Non-image Drive items show file-type icons or placeholders instead of fake images.
- Tap opens a bottom sheet preview with file metadata and Open link action.
- Long-press select is client-side only and does not create batch archive/delete mutations.

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
- Settings is reached from the Profile avatar menu and is not a standalone global topbar gear or bottom-nav item.
- The UI uses Inter as the base type family.
- The UI follows the Visual PWA Mobile-First light native design tokens from 2026-05-04.
- Primary color is `#007AFF`.
- New or edited UI uses shared semantic tokens for typography and color; component code does not introduce hardcoded font, color, or palette literals.
- Status chips and loading states use semantic status tokens.
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
