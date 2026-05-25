# Micro Task Backlog - Phase Awal MVP and Phase 2

This backlog replaces older sprint assumptions. Implement one micro-task at a time.

## Phase Status

```text
Phase 1 MVP Baseline: PASS
Current Active Phase: Phase 2 Micro-Task Implementation
Phase 2 Lock Status: LOCKED FOR MICRO-TASK IMPLEMENTATION
```

Phase 1 pass is documented in `docs/PHASE_1_PASS_AUDIT_2026_05_15.md`. Phase 2 implementation is locked by `docs/PHASE_2_ARCHITECTURE_LOCK.md`. Implement only one Phase 2 micro-task at a time and keep Controller/Helper work behind prompt scale and queue readiness.

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
- MT-DRIVE-HIERARCHY-01
- P2-LOCK-01, P2-S1-001, P2-S1-002, P2-S1-002B, P2-S2-001, P2-S2-002, P2-S3-001A, P2-S3-001B, P2-S4-001A
- DOCS-HUASHU-ADAPT-00, DOCS-HUASHU-ADAPT-01
- AI-MEDIA-001, AI-MEDIA-002, AI-MEDIA-003, AI-MEDIA-004, AI-MEDIA-005, AI-MEDIA-006, AI-MEDIA-007, AI-MEDIA-008, AI-MEDIA-009, AI-MEDIA-010, AI-MEDIA-011, UI-OP-POLISH-05

AI Media Lab frontend dummy audit:

- AI-MEDIA-PRD-001 through AI-MEDIA-012 are tracked below. The current branch audit is recorded in `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md`.

## UI/UX Polish References
- [UI_UX_POLISH_SEGMENT_A_TOKEN_AUDIT_PROMPT.md](UI_UX_POLISH_SEGMENT_A_TOKEN_AUDIT_PROMPT.md)
- [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
- [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
- [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
- [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
- [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
- [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)

## AI Media Lab Frontend-First Stream

Source PRD: `docs/AI_MEDIA_LAB_PRD.md`.
Current branch audit: `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md`.

This section registers AI Media Lab as an approved stream-specific PRD for later frontend-first implementation. The Phase 1 baseline in `docs/PRD_SOURCE_OF_TRUTH.md` remains unchanged: `/products/new` stays the entrypoint, mobile bottom navigation remains `Dashboard`, `Intake`, `Produk`, `Prompt`, and `Drive`, and Controller/Flow constraints remain governed by the existing locks.

Section lock:

- Current audit task `AI-MEDIA-012` is the docs audit recorded in `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md`.
- Later AI Media Lab work must be implemented one micro-task at a time.
- Frontend tasks use dummy data first and must not call Magnific or add backend wiring.
- Backend, migrations, real Magnific API calls, encrypted key storage, task DB wiring, and Drive output wiring are out of scope until the frontend UI is approved.

Implementation order:

1. `AI-MEDIA-PRD-001` - register approved PRD and backlog sequence.
2. `AI-MEDIA-001` - route placeholders.
3. `AI-MEDIA-002` - Dashboard entrypoint.
4. `AI-MEDIA-003` - desktop sidebar group.
5. `AI-MEDIA-004` - overview dummy UI.
6. `AI-MEDIA-005` - shared UI components.
7. `AI-MEDIA-006` - Motion Control dummy page.
8. `AI-MEDIA-007` - Image to Video dummy page.
9. `AI-MEDIA-008` - Upscaler dummy page.
10. `AI-MEDIA-009` - History dummy page.
11. `AI-MEDIA-010` - Usage dummy page.
12. `AI-MEDIA-011` - Magnific settings minimal dummy UI.
13. `AI-MEDIA-012` - frontend dummy readiness audit.

### AI-MEDIA-PRD-001 - Register AI Media Lab stream PRD
**Goal:** Register AI Media Lab as an approved stream-specific PRD and prepare this backlog for later frontend-first implementation.
**Owner:** Codex
**Scope:** docs only; `docs/01_README_START_HERE.md`, `docs/MICRO_TASK_BACKLOG.md`, and verification that `docs/AI_MEDIA_LAB_PRD.md` exists and is readable.
**Acceptance:** README references the stream PRD; this backlog records the ordered frontend-first task sequence; no runtime code, routes, components, navigation changes, migrations, dependencies, API calls, key storage, task DB wiring, or Drive output wiring are added.

### AI-MEDIA-001 - Route placeholders
**Goal:** Add static placeholder pages for the final AI Media Lab routes.
**Owner:** Codex
**Scope:** `/tools/ai-media`, `/tools/ai-media/motion-control`, `/tools/ai-media/image-to-video`, `/tools/ai-media/upscaler`, `/tools/ai-media/history`, `/tools/ai-media/usage`, and `/settings/magnific` placeholders only.
**Acceptance:** routes do not 404; pages are static/dummy only; no backend/API calls, migrations, navigation expansion beyond the approved route placeholders, or dependencies are added.

### AI-MEDIA-002 - Dashboard entrypoint
**Goal:** Add a Dashboard quick action card linking to `/tools/ai-media`.
**Owner:** Codex
**Scope:** Dashboard entrypoint only.
**Acceptance:** mobile Dashboard exposes `AI Media Lab` with `Buka` CTA; mobile bottom navigation remains unchanged; no backend calls are added.

### AI-MEDIA-003 - Desktop sidebar group
**Goal:** Add the approved desktop sidebar group for AI Media Lab.
**Owner:** Codex
**Scope:** desktop sidebar navigation and route title metadata only.
**Acceptance:** parent `AI Media Lab` links to `/tools/ai-media`; children are `Motion Control`, `Image to Video`, `Upscaler`, `History`, and `Usage`; there is no `Overview` child; collapsed sidebar hides children; mobile nav items remain unchanged.

### AI-MEDIA-004 - Overview dummy UI
**Goal:** Build the `/tools/ai-media` overview/lobby with structured dummy data.
**Owner:** Codex
**Scope:** overview page UI only.
**Acceptance:** provider status, usage mini summary, full-clickable tool cards, settings shortcut, loading, empty, and error dummy states render; mobile uses a 2-card grid; desktop uses up to 3 columns; no native dropdown, backend call, migration, or live API call is added.

### AI-MEDIA-005 - Shared UI components
**Goal:** Create reusable frontend components needed by the AI Media Lab dummy UI.
**Owner:** Codex
**Scope:** shared AI Media Lab UI components only.
**Acceptance:** components use existing semantic tokens/classes, shared loading/empty/error patterns, and no hardcoded component-level color or typography values; no backend call is added.

### AI-MEDIA-006 - Motion Control dummy page
**Goal:** Build the Motion Control dummy workflow page.
**Owner:** Codex
**Scope:** frontend dummy stepper, preview, mobile log, desktop log panel, and dummy generate state.
**Acceptance:** steps render for Provider, Reference, Prompt, Settings, Preview & Generate, and Output; dummy logs include fallback behavior; operator toast copy stays simple; no live API call is added.

### AI-MEDIA-007 - Image to Video dummy page
**Goal:** Build the Image to Video dummy workflow page.
**Owner:** Codex
**Scope:** frontend dummy stepper, preview, log terminal, and dummy output state.
**Acceptance:** Provider, Image, Prompt, Settings, Preview & Generate, and Output steps render with structured dummy state; no unsupported first-wave fields or live API calls are added.

### AI-MEDIA-008 - Upscaler dummy page
**Goal:** Build the Upscaler dummy workflow page.
**Owner:** Codex
**Scope:** frontend dummy stepper, before/after preview, and log terminal.
**Acceptance:** mobile compare layout avoids side-by-side overlap; desktop shows a compare panel; no backend call, migration, or live API call is added.

### AI-MEDIA-009 - History dummy page
**Goal:** Build the AI Media Lab history dummy page.
**Owner:** Codex
**Scope:** frontend dummy task history only.
**Acceptance:** mobile uses compact cards, desktop uses searchable list/table plus drawer, and dummy rows include success, failed, running, and waiting-for-key states; no hard delete flow or backend wiring is added.

### AI-MEDIA-010 - Usage dummy page
**Goal:** Build the AI Media Lab usage dummy page.
**Owner:** Codex
**Scope:** frontend dummy usage and provider/fallback state only.
**Acceptance:** dummy metrics match the expected future backend shape for requests, status counts, active keys, rate-limited keys, fallback readiness, last used, and recent errors; no real usage tracking or backend wiring is added.

### AI-MEDIA-011 - Magnific settings minimal dummy UI
**Goal:** Build the minimal Magnific settings dummy UI.
**Owner:** Codex
**Scope:** `/settings/magnific` dummy settings UI only.
**Acceptance:** UI exposes only `Nama key`, `API key`, `Tes koneksi`, `Simpan`, optional `Status`, and optional `Terakhir dites`; dummy states cover no key, loading, success, failed, saved, and invalid key; no raw key persistence, encrypted storage, migration, or live API call is added.

### AI-MEDIA-012 - Frontend dummy readiness audit
**Goal:** Audit the completed AI Media Lab frontend dummy implementation before backend work.
**Owner:** Codex
**Scope:** docs audit only; `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md` and backlog progress notes.
**Acceptance:** audit covers route availability, Dashboard quick action, desktop sidebar group, mobile nav, overview grid/cards, local back button, topbar boundary, stepper pages, previews, log terminal, simplified errors, Magnific settings field scope, native select exclusion, backend/API/migration exclusion, verification status, and follow-up risks.

## UI Shell Rebrand Polish Sequence

The visual shell rebrand is locked by `docs/UI_SHELL_REBRAND_LOCK.md`. These tasks are presentation-only unless a later task explicitly expands scope.

1. `UI-SHELL-REBRAND-01` - audit current UI shell. _(DONE: `docs/UI_SHELL_REBRAND_AUDIT.md`)_
2. `UI-SHELL-REBRAND-02` - global shell/token polish. _(DONE: `src/app/globals.css`)_
3. `UI-SHELL-CTRL-01` - controller shell baseline polish. _(PARTIAL BASELINE: `src/app/controller/page.tsx`, `src/app/controller/controller-workflow-stepper.tsx`, `src/app/controller/controller-manifest-popover.tsx`, `src/app/globals.css`; follow-up Controller polish is mapped below before runtime coding.)_
4. `UI-SHELL-PROMPTS-01` - prompts shell polish. _(DONE: `src/app/prompts/page.tsx`, `src/app/prompts/prompt-workbench-list.tsx`, `src/app/prompts/prompt-detail-panel.tsx`, `src/app/globals.css`)_
5. `UI-SHELL-PRODUCT-NEW-01` - intake shell polish.
6. `UI-SHELL-PRODUCTS-01` - products shell polish.
7. `UI-SHELL-DRIVE-01` - drive shell polish.
8. `UI-SHELL-SETTINGS-01` - settings account shell polish.

## Operator Shell Polish Fix Queue

Source request: operator UI polish follow-up, 2026-05-20. These tasks are scoped to presentation and existing owner-scoped data wiring only; no schema migration, service role exposure, or new workflow concept is approved.

### UI-OP-POLISH-00 - Backlog and scope lock _(IN PROGRESS)_
**Goal:** Document the approved shell/settings/intake/dashboard/prompt/search polish before runtime implementation.
**Owner:** Codex
**Scope:** backlog docs only.
**Acceptance:** micro-tasks below are recorded with scope, constraints, and validation expectations.

### UI-OP-POLISH-01 - Notification and profile shell polish
**Goal:** Replace notification floating overview with a right-side scrollable panel, make mobile full-page style, fix avatar button transparency, fix theme toggle stale-state behavior, move mobile feedback overview below the topbar, and simplify profile overview actions.
**Owner:** Codex
**Scope:** `src/components/operator/topbar-global-controls.tsx`, `src/components/operator/theme-toggle.tsx`, shell feedback CSS, and related shared CSS only.
**Acceptance:** notifications load in a right drawer/sheet with thin branded scrollbar; avatar trigger is transparent on mobile and desktop; theme choice does not revert after reopening the menu; mobile feedback no longer floats above bottom nav; profile menu shows theme below the profile block, removes `Kelola akun`, keeps `Pengaturan` and `Sign out`, and exposes `Ganti Akun` beside the active profile name.
**Follow-up:** Desktop notification activity scroll must not close the panel; scroll-to-close remains limited to the desktop profile popover.

### UI-OP-POLISH-02 - Settings duplicate action cleanup
**Goal:** Remove duplicated theme and logout actions from Settings because theme and sign out are owned by the avatar overview.
**Owner:** Codex
**Scope:** `/settings` overview and `/settings/account` only.
**Acceptance:** Settings no longer renders the theme selector or Account logout action; account/token and pairing behavior are unchanged.

### UI-OP-POLISH-03 - In-app PWA install card cleanup
**Goal:** Remove the custom install-app card and its local bridge while preserving browser-native PWA manifest/icon support.
**Owner:** Codex
**Scope:** install-card component/usages/CSS/tests/bridge script only.
**Acceptance:** no in-app install card remains on desktop or Intake; manifest and icon metadata stay intact; no dependency is kept solely for the removed card.

### UI-OP-POLISH-04 - Intake tablet width correction
**Goal:** Remove the unintended side gutters around the Intake card at 450px-750px.
**Owner:** Codex
**Scope:** `/products/new` layout CSS only.
**Acceptance:** Intake uses available width cleanly across 450px-750px without changing the locked capture/metadata lifecycle.

### UI-OP-POLISH-05 - Dashboard greeting hierarchy
**Goal:** Remove duplicate dashboard body header and replace it with an operator greeting hierarchy.
**Owner:** Codex
**Scope:** dashboard page/loading/error CSS only.
**Acceptance:** dashboard body starts with `Halo`, prominent operator name, concise subtitle, and monospace last-updated timestamp; topbar remains the global page title.

### UI-OP-POLISH-06 - Prompt variant launcher redesign
**Goal:** Remove AI subtitle copy from variant choices and open the variant picker from prompt creation/bulk queue buttons instead of showing a separate field.
**Owner:** Codex
**Scope:** prompt workbench, variant picker shared component, and related CSS only.
**Acceptance:** `Buat Prompt` and bulk prompt actions open the picker first; variant options use a custom scroll surface without verbose copy; bulk submit label becomes `Antrikan`; prompt contracts and server actions are unchanged.
**Follow-up:** Shared picker options use neutral Vercel-like interactions with no blue hover/focus/active treatment, tighter value spacing, and no subtitle rows in picker values/options. Prompt action launchers (`Buat Prompt`, `Antrikan`) open a compact floating option menu anchored to the button on mobile and desktop, without a sheet header or close button.

### UI-OP-POLISH-07 - Search and clear action cleanup
**Goal:** Standardize `Bersihkan` behavior across product and prompt surfaces.
**Owner:** Codex
**Scope:** shared search input plus product/prompt list surfaces.
**Acceptance:** search clear moves inside the search field as an icon-only control; bulk clear controls only appear when there is an active selection; labels do not wrap on compact widths.

### UI-OP-POLISH-08 - Products bulk selection and archive
**Goal:** Add selection mode to `/products` desktop table and mobile cards for bulk archive (soft delete).
**Owner:** Codex
**Scope:** `/products` desktop table and mobile cards, product selection mode, bulk archive server action, mobile long-press + tap fallback, loading/empty/error/disabled states.
**Constraints:**
- Archive-first only; no hard delete.
- Server-side owner/workspace validation; never trust client selected IDs.
- Max bulk size: 50.
- No Drive batch archive/delete.
- No schema migration unless later audit proves necessary.
- Select-all scope: visible/loaded rows only, not cross-pagination.
- Mobile must not use dense tables.
**Acceptance:**
- Desktop can select visible eligible products and archive them in bulk.
- Mobile can enter selection by long-press or explicit `Pilih` fallback.
- Archived products leave active list via existing `ARCHIVED` exclusion.
- Bulk action requires confirmation.
- No permanent delete is introduced.
- Keyboard shortcuts: `Escape` clears/exits selection, `Ctrl/Cmd+A` selects visible eligible.
- All visible non-archived products are archivable in first wave.

### UI-OP-POLISH-09 - Prompts bulk queue selection parity
**Goal:** Polish existing prompts bulk selection for queue parity with products selection grammar, add mobile long-press, and enforce main-page delete guardrail.
**Owner:** Codex
**Status:** SUPERSEDED by `PROMPT-SINGLE-GEN-01` on 2026-05-25. Prompt bulk queue is removed from `/prompts`; do not implement this task.
**Scope:** `/prompts` workbench selection UX, mobile long-press, clear selection, disabled/guarded states, and main-page destructive action removal.
**Constraints:**
- Obsolete: `bulkEnqueuePromptPacks`, prompt queue drawer, and prompt queue API routes must not be restored for MVP.
- `ai_tasks` remains allowed only as an internal single-generation ledger for one prompt version.
**Acceptance:**
- Superseded by `PROMPT-SINGLE-GEN-01` acceptance.

## Controller UI Polish Runtime Mapping

Source planning doc: `docs/codex-controller-polish-tasks.md`.

Repo adaptation lock:

- The original task pack is implementation guidance, not direct copy/paste instructions.
- Use the actual repo targets: `src/app/controller/controller-workflow-stepper.tsx`, `src/app/controller/controller-manifest-popover.tsx`, `src/app/controller/page.tsx`, `src/components/operator/status-badge.tsx`, `src/components/operator/loading-skeleton.tsx`, and `src/app/globals.css`.
- Do not reintroduce the stale inline `ControllerWorkflowRail` or inline `<details>` manifest panel assumptions from the task pack.
- Runtime Controller polish remains presentation-only and must not change server actions, Supabase queries, form field names, manifest schema, helper callback payloads, route contracts, or workspace isolation.
- Verification for each runtime polish task is `npm run lint`, `npm run typecheck`, and `npm run build`.

### CTRL-POLISH-00 - Controller polish task mapping
**Goal:** Map `docs/codex-controller-polish-tasks.md` to the actual Controller repo before runtime coding.
**Owner:** Codex
**Scope:** docs lock and backlog stream only; no runtime code.
**Acceptance:** UI shell lock, Phase 2 lock, backlog streams, and micro-task backlog all describe the adapted Controller polish targets and constraints.

### CTRL-POLISH-01 - StatusBadge visual weight completion
**Source tasks:** TASK 01.
**Goal:** Finish and verify shared `StatusBadge` visual weight controls.
**Owner:** Codex
**Scope:** `src/components/operator/status-badge.tsx`, `src/app/globals.css`, and targeted Controller usages only.
**Repo mapping:** `size`, `variant`, and `muted` props already exist; this task should verify CSS behavior, dark/light readability, inferred tone coverage, and secondary badge usage.
**Acceptance:** small badges suppress the dot, muted badges resolve neutral, Flow statuses map to locked tones, existing usages remain backwards compatible, and verification commands pass.

### CTRL-POLISH-02 - Controller stepper and header hierarchy
**Source tasks:** TASK 02 and TASK 06.
**Goal:** Remove horizontal stepper friction and consolidate Controller header/stepper visual hierarchy.
**Owner:** Codex
**Scope:** `src/app/controller/controller-workflow-stepper.tsx`, `src/app/controller/page.tsx` only if needed for display data, and `src/app/globals.css`.
**Repo mapping:** current runtime uses `ControllerWorkflowStepper` and `controller-workflow-header`; legacy `.controller-stepper-summary-strip` blocks exist in CSS and must not be treated as the live component unless loading skeletons still need them.
**Acceptance:** 1024px desktop has no Controller stepper horizontal scroll, active step remains obvious, current-step content behavior is preserved, duplicate/legacy Controller stepper CSS is consolidated, and verification commands pass.

### CTRL-POLISH-03 - BatchCard action hierarchy and icons
**Source tasks:** TASK 03 and TASK 10.
**Goal:** Separate BatchCard read state from operator actions and make action icons semantically consistent.
**Owner:** Codex
**Scope:** `src/app/controller/page.tsx` and `src/app/globals.css`.
**Repo mapping:** current `BatchCard` still uses a flat lane-card structure, `RefreshCcw` for `Tandai Masuk`, and no icon for `Tutup`; update only presentation and icon imports.
**Acceptance:** info, stage, and action zones are visually separated; stage rows do not read as nested cards; `Mulai Flow`, `Tandai Masuk`, and `Tutup` sit in one action row when present; all action buttons have meaningful icons; verification commands pass.

### CTRL-POLISH-04 - Flow account forms and batch selection feedback
**Source tasks:** TASK 04 and TASK 07.
**Goal:** Fix responsive lane-key forms and make selected/skipped batch cards scan clearly.
**Owner:** Codex
**Scope:** `src/app/controller/page.tsx` and `src/app/globals.css`.
**Repo mapping:** current create-account form still uses a generic stacked form, and batch selection still uses static `Pilih batch` checkbox copy without full-card checked feedback.
**Acceptance:** lane-key forms do not overflow at 900px desktop width, create-account form is visually separated, checked batch cards are distinct with CSS-only state, skipped cards are de-emphasized, and verification commands pass.

### CTRL-POLISH-05 - Controller loading, mobile fallback, and manifest popover
**Source tasks:** TASK 05, TASK 08, and TASK 09.
**Goal:** Match Controller loading to the loaded structure, avoid mobile desktop-content flash, and polish the actual manifest popover.
**Owner:** Codex
**Scope:** `src/app/controller/loading.tsx`, `src/components/operator/loading-skeleton.tsx`, `src/app/controller/page.tsx`, `src/app/controller/controller-mobile-redirect.tsx` only if necessary, `src/app/controller/controller-manifest-popover.tsx`, and `src/app/globals.css`.
**Repo mapping:** TASK 08 must be adapted to the existing `ControllerManifestPopover`; do not replace it with the stale inline `<details>` panel.
**Acceptance:** loading state matches Controller structure, mobile users see a desktop-required fallback before redirect with no desktop content flash, manifest popover remains accessible and visually intentional, and verification commands pass.

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
**Acceptance:** new generation emits v2 copy JSON; I2I First Frame generates one 2x2 storyboard image with 4 panels using `@character`, `@environment`, and product reference; I2I Last Frame uses `@firstframe` and remains hidden/persisted for compatibility; I2V uses the `@firstframe` storyboard plus legacy `@lastframe` with 8-second 4-part timeline, treating grid borders and panel numbers as guidance only; legacy prompt packs remain readable.

Superseded follow-up: MT-PROMPT-SINGLE-FRAME-01 replaces the runtime default storyboard output with a single first-frame image while keeping the same storage shape for compatibility.

### MT-PROMPT-SINGLE-FRAME-01 - Single-frame prompt default
**Goal:** Replace the default generated `Storyboard Image` output with `First Frame Image` while preserving I2V compatibility.
**Owner:** Codex
**Scope:** prompt lock docs, prompt generation contract, mock/live prompt wording, visible/export labels, and targeted tests only.
**Acceptance:** new generation produces a single first-frame image prompt instead of 2x2 storyboard/grid/panel instructions; hidden `I2I Last Frame` remains persisted; I2V keeps `frame_inputs: ["@firstframe", "@lastframe"]` but treats `@firstframe` as the single starting image and `@lastframe` as compatibility only; prompt UI/export labels use `First Frame Image`; no wizard, provider selector, bulk variant logic, schema migration, or live video provider integration is added.

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

### MT-BULK-IMPORT-01 - Desktop bulk product import _(DONE)_
**Goal:** Add desktop-only CSV/XLSX product import from scraping exports.
**Owner:** Codex
**Scope:** `/products/new` desktop panel, server Route Handlers, existing product/intake/Drive metadata paths, and product detail marketplace link action.
**Acceptance:** CSV/XLSX preview normalizes required scrape fields, optional fields render collapsed, import downloads image bytes to Google Drive, creates draft products with auto-reviewed `bulk_import_v1` scraping metadata, and product detail shows `Buka link` only when a marketplace link exists.

### MT-BULK-IMPORT-02 - Durable bulk import job progress _(DONE)_
**Goal:** Make desktop bulk upload survive route changes and refresh, support explicit cancel, and show detailed realtime process logs.
**Owner:** Codex
**Scope:** bulk import job migration, `/api/products/bulk-import/jobs/**`, `/products/new` desktop panel, shell resume runner, and docs/schema lock only.
**Acceptance:** import state persists in Supabase, refresh/navigation reconnects to the same job, cancel keeps already imported rows and marks remaining rows cancelled, logs stream through Supabase Realtime with polling fallback, and verification commands pass or blockers are documented.

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
**Goal:** Remove the workspace picker from the shell, keep fixed bottom nav for Intake/Produk/Prompt/Drive, and add the approved global topbar controls.
**Owner:** Codex
**Acceptance:** non-Settings routes show Notifications and Profile avatar menu, `/settings` shows no duplicate standalone Settings action, and safe-area spacing is preserved.

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

### MT-DRIVE-HIERARCHY-01 - Drive hierarchy and view mode _(DONE)_
**Goal:** Make `/drive` browse like Drive from the active Affiliate Account workspace root instead of showing folder descendants in one flat level, and add Grid/List modes.
**Owner:** Codex
**Acceptance:** root starts at the active workspace folder, folder tap navigates into direct children, file tap keeps the preview behavior, search is global with path context, upload target follows the active folder, and mobile List mode remains compact rather than table-like.

Known visual/backend gaps:

- No schema migration has been added for Drive thumbnail metadata.
- Drive thumbnails now resolve server-side preview URLs for image-like items when Drive bytes are available, and still fall back to icons/placeholders.
- The shared media thumbnail frame is reused across `/products` and `/drive` for compact PWA/mobile compatibility.
- Drive multi-select is client-side only.
- Settings service status still needs a more explicit backend view-model contract.
- No fake metrics or fake service statuses should be introduced.

## S1 - Navigation and Route Lock

### S1-001 - Lock desktop and mobile nav _(DONE)_
**Goal:** Shell navigation is Dashboard, Intake, Produk, Prompt, Drive. Mobile bottom nav is Dashboard, Intake, Produk, Prompt, Drive.
**Owner:** Codex
**Acceptance:** `/controller` is hidden from shell nav, `/flow` and `/controller` redirect to `/products/new`, Settings is reached by the Profile avatar menu, and `/settings` has no duplicate standalone Settings action.

### S1-002 - Route compatibility _(DONE)_
**Goal:** Keep `/intake`, `/flow`, and `/outputs` compatibility behavior without creating duplicate primary funnels.
**Owner:** Codex
**Acceptance:** `/products/new`, `/prompts`, `/controller`, and product detail remain the locked working surfaces.

### S1-003 - Shell settings and account lock _(DONE)_
**Goal:** Move Chrome profile pairing into `Pengaturan > Account` and allow Sign out from the Profile avatar menu and Account, with no duplicate shell settings entry points.
**Owner:** Codex
**Acceptance:** Settings remains the only configuration hub, the shell uses Notifications and Profile avatar menu as global topbar controls, Sign out is allowed from the Profile avatar menu and Account, and Chrome profile pairing includes Buat, Salin, Unduh JSON, and Lepas Pairing.

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
**Acceptance:** `/settings` stays overview-first, nested sections exist for Workspace, Affiliate Profiles, Gemini, Drive, Account, and Flow link, desktop gets compact internal section navigation, mobile stays scroll-efficient, `Pengaturan > Account` remains the place for Chrome pairing and App API Token, and sign out is allowed from Account and the Profile avatar menu.

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

## Phase 2 Locked Micro-Task Queue

### P2-LOCK-01 - Phase 2 architecture implementation lock _(DONE)_
**Goal:** Promote Phase 2 from discussion to a source-of-truth implementation lock with sequencing and micro-task boundaries.
**Owner:** Codex
**Scope:** source-of-truth docs only.
**Acceptance:** Phase 2 status is locked for micro-task implementation; prompt scale and queue work precede Controller reactivation; no mobile Flow, browser automation, or helper secret storage is introduced.

### P2-S1-001 - Prompt readiness projection foundation _(DONE)_
**Goal:** Add the server-side readiness projection used by the Prompt Batch Workbench.
**Owner:** Codex
**Scope:** prompt/product server helpers and targeted tests; no new UI route and no schema migration unless query evidence requires it.
**Acceptance:** rows classify into `Needs Evidence`, `Needs Metadata`, `Needs Review`, `Ready for Prompt`, `Prompt Queued`, `Prompt Generated`, or `Prompt Failed`; raw `products.status` is never the only readiness source; only `Ready for Prompt` rows are eligible for bulk enqueue.
**Implementation note:** Computed projection now lives in `src/lib/prompts/prompt-readiness-projection.ts` and server aggregation in `src/lib/server/prompt-readiness.ts`; no schema migration was required.

### P2-S1-002 - Desktop Prompt Batch Workbench _(DONE)_
**Goal:** Upgrade `/prompts` desktop behavior into a batch workbench while preserving the mobile prompt list.
**Owner:** Codex
**Scope:** `/prompts` UI, readiness filters, selection, empty/loading/error states, and enqueue affordance placeholder only.
**Acceptance:** desktop can filter and select prompt-ready products; non-ready rows show why they are blocked; mobile nav and mobile prompt behavior remain intact.
**Implementation note:** Verified by `tests/e2e/prompt-workbench.spec.ts` and the prompt-readiness checks in `tests/e2e/gemini-backend-hardening.spec.ts`; the desktop workbench filters, selects, paginates, and keeps mobile behavior intact.

### P2-S1-002B - Bulk Import auto-reviewed prompt handoff _(DONE)_
**Goal:** Let valid Bulk Import scraping rows skip manual metadata review and create prompts directly from the Bulk Import monitor panel.
**Owner:** Codex
**Scope:** Bulk Import metadata persistence/backfill, prompt readiness projection, `/products/new` Bulk Import monitor prompt action, and targeted docs/tests only.
**Acceptance:** new and existing `bulk_import_v1` rows store reviewed metadata, Bulk Import marketplace sources are active evidence, ready imported rows show `Buat Prompt` in the monitor panel, OCR/Vision metadata still requires review, and no dedicated prompt batch table or Supabase Queues are introduced.
**Implementation note:** Verified by `tests/e2e/bulk-import-prompt-readiness.spec.ts`; `bulk_import_v1` rows store reviewed metadata, surface prompt readiness, and expose `Buat Prompt` from the monitor panel without adding a prompt batch table.

### MT-METADATA-ENRICHMENT-01 - Gemini metadata completeness for prompt readiness
**Goal:** Prevent prompt generation from incomplete Prompt Essentials and make Bulk Import generate Gemini-enriched metadata before prompt handoff.
**Owner:** Codex
**Scope:** metadata validation, prompt readiness guards, Bulk Import row processing, single-upload metadata regeneration fallback, prompt/intake wording, docs, and targeted tests only; no schema migration.
**Acceptance:** all seven Prompt Essentials are required before prompt generation, Bulk Import rows call Gemini after product/image/source creation and become prompt-ready only when enrichment succeeds, failed/incomplete enrichment leaves a recoverable intake error, and the single upload review fallback exposes `Regenerate Metadata` instead of the product detail button.

### P2-S2-001 - AI task queue prompt enqueue contract _(DONE)_
**Goal:** Use existing `ai_tasks` for durable bulk prompt generation jobs.
**Owner:** Codex
**Status:** SUPERSEDED for prompt operator UI by `PROMPT-SINGLE-GEN-01` on 2026-05-25. Keep `ai_tasks` only as an internal single-generation ledger; do not restore prompt bulk queue UI/API.
**Scope:** enqueue server action/route, validation, idempotency, and tests; no Supabase Queues and no dedicated prompt batch table in this wave.
**Acceptance:** selected ready products enqueue prompt-generation tasks with owner scope, selected Gemini routing metadata, retry counters, and cancel-before-run support.
**Implementation note:** Verified by `tests/e2e/prompt-workbench.spec.ts`; ready products enqueue owner-scoped `ai_tasks` with Gemini metadata and cancel-before-run support.

### P2-S2-002 - Prompt queue runner and progress _(DONE)_
**Goal:** Execute queued prompt jobs with quota-aware Gemini routing and observable progress.
**Owner:** Codex
**Status:** SUPERSEDED for prompt operator UI by `PROMPT-SINGLE-GEN-01` on 2026-05-25. Single prompt generation may still use `ai_tasks` status/polling internally.
**Scope:** server runner, retry/failure handling, progress polling, and targeted tests.
**Acceptance:** jobs move through queued/running/success/failed/retrying/waiting states, preserve prompt pack versioning, and show progress without keeping prompt detail open.
**Implementation note:** Verified by `tests/e2e/prompt-workbench.spec.ts`; queue rows expose selected Gemini keys, retry/cancel actions, and live progress without requiring prompt-detail focus.

### P2-S5-001 - Large dataset prompt/workbench hardening _(READY NEXT)_
**Goal:** Replace 200-row client assumptions with server-side pagination/search for prompt workbench inputs.
**Owner:** Codex
**Scope:** product/prompt list query helpers, pagination/search contracts, and index review.
**Acceptance:** thousands of products can be paged and filtered by readiness/search without loading all rows client-side.

### PROMPT-SINGLE-GEN-01 - Prompt single generate drawer refactor
**Goal:** Remove prompt bulk queue dependencies and refactor `/prompts` into the single-product `Output / Generate / History` drawer flow used by Share Caption.
**Owner:** Codex
**Scope:** prompt docs, prompt_packs migration, `/prompts` workbench/drawer UI, prompt generation/regeneration server actions, Gemini prompt output variant contract, output renderer, and targeted prompt tests.
**Constraints:**
- No prompt bulk selection, bulk setup drawer, queue drawer, or queue run-next API on `/prompts`.
- Do not remove the shared `ai_tasks` table; it remains available for single generation task status and Gemini usage events.
- New prompt generate UI fields are only `Angle`, `Mode video`, `Voiceover`, and `Jumlah varian`; regenerate adds `Instruksi Revisi`.
- Angle uses the Share Caption angle set.
- Variant count is 1-4 and persists on `prompt_packs`.
- First generated variant is mirrored to legacy prompt JSON fields for Flow/export compatibility.
**Acceptance:** `Buat Prompt` opens `?detail=<productId>&tab=generate`; generation creates one prompt version with 1-4 output variants; Output shows variants; History preserves versions; regenerate returns to Generate with previous settings; bulk prompt queue UI/API is gone.

### P2-S3-001A - Stage-aware manifest foundation _(DONE)_
**Goal:** Add manifest/callback foundations for `FIRST_FRAME`, `LAST_FRAME`, and `VIDEO` without reactivating `/controller` UI.
**Owner:** Codex
**Scope:** manifest schema v2, helper callback stage metadata, generated file migration, and source-of-truth docs.
**Acceptance:** manifest exports retain legacy `jobs[]` and add `stage_jobs[]`; helper callback can import frame/video stages; Chrome profile paths remain local-only; no Google Flow auto-click or auto-submit is added.

### P2-S3-001B - Controller read-only stage lanes _(DONE)_
**Goal:** Reactivate `/controller` as a desktop-only read-only stage lane preview after prompt queue stability.
**Owner:** Codex
**Scope:** desktop Controller surface only; no mutating controls beyond existing retained backend paths.
**Acceptance:** stage lanes show `FIRST_FRAME`, `LAST_FRAME`, `VIDEO`, import/review state, Flow account lane context, and no fake Google Flow live progress.
**Implementation note:** Verified by `src/app/controller/page.tsx`, `src/lib/server/controller.ts`, and the stage-manifest contract in `src/lib/flow/stage-manifest.ts`; the lanes render real batch/helper state without fake live progress.

### P2-S4-001A - Helper stage pack export contract _(DONE)_
**Goal:** Turn manifest `stage_jobs[]` into a precise helper staging contract for prompt TXT files and local folders.
**Owner:** Codex
**Scope:** helper docs/contracts and app manifest export contract only unless a helper repo is explicitly provided.
**Acceptance:** helper can prepare stage prompt files and folder structure from manifest v2; local paths and OAuth tokens remain local-only.
**Implementation note:** Verified by `tools/windows-helper/README.md` and `tools/windows-helper/src/index.mjs`; `prepare` writes manifest/prompt folders from `stage_jobs[]` and keeps local paths/config local-only.

### DOCS-HUASHU-ADAPT-00 - Huashu workflow discipline lock _(DONE)_
**Goal:** Adapt huashu-design as workflow discipline only for Prompt Pack, Flow Controller, manifest, and Windows Helper work.
**Owner:** Codex
**Scope:** docs only; no runtime code, UI, dependencies, or migration.
**Acceptance:** docs clarify huashu-design is not a dependency or feature source; no video editor/PPT/HTML animation/design advisor is approved; desktop production flow, active workspace controller isolation, manifest semantic validation, explicit stage discipline, anti-slop prompt grounding, export verification, and operator status targets are locked.

### DOCS-HUASHU-ADAPT-01 - Desktop production flow acceptance criteria _(DONE)_
**Goal:** Add precise acceptance criteria for the refined desktop Flow Controller and Helper production pipeline.
**Owner:** Codex
**Scope:** docs only; no runtime code and no migration.
**Acceptance:** criteria require active workspace-only controller items and batches, reject the four-grid board as the final desktop UX, lock the horizontal stepped workflow, block invalid manifest export, map helper callback stages to operator-facing state, label Flow account availability as estimated until helper verification, and forbid Chrome profile paths in Supabase.

### P2-S4-001B - Manifest semantic validation and helper readiness gate
**Goal:** Add runtime validation that exported manifests are coherent before helper prep or production-ready handling.
**Owner:** Codex
**Scope:** manifest validation helpers, export path, helper prepare path, and targeted tests only; no schema migration.
**Acceptance:** invalid schema version, missing Drive/Flow/helper fields, cross-workspace batch context, bad stage order, bad dependencies, bad input handles, or generic ungrounded prompt text prevents runnable export/prep and returns a clear error.

### P2-S3-001C - Multi Chrome profile controlled run workflow
**Goal:** Add controlled multi-lane operator workflow for Flow accounts and Chrome profiles.
**Owner:** Codex
**Scope:** Controller/Helper contract and desktop UI after read-only lanes are stable.
**Acceptance:** one Flow account maps to one Chrome profile lane in helper local config; operator chooses active lanes; app never auto-clicks or auto-submits Flow.

### P2-S3-001D - Chrome profile lane labels and pairing states
**Goal:** Separate app-visible lane labels from helper-local Chrome profile paths and define the pairing states operators can see.
**Owner:** Codex
**Scope:** Settings account surface, controller support panel, and source-of-truth docs only; no migration.
**Acceptance:** Supabase may store lane key labels but never absolute Chrome profile paths; the app shows `Not paired`, `Lane key set`, `Helper verified`, `Session expired`, and `Unavailable`; the app only claims paired when helper verification is current.

### P2-S3-001E - Helper lane verification handshake
**Goal:** Define the helper confirmation flow for lane availability and session expiry without exposing local profile paths.
**Owner:** Codex
**Scope:** helper callback/handshake contract, operator status wiring, and docs only; no helper runtime implementation.
**Acceptance:** the helper can report `status`, `verified_at`, `reason`, and `session_state` for a `flow_account_code` plus `chrome_profile_lane_key` request, and the app uses that confirmation to update pairing state instead of inferring pairing from stored metadata alone.

### P2-S3-001F - Controller production status mapping
**Goal:** Map real stage/helper/output state into the operator-facing desktop production labels.
**Owner:** Codex
**Scope:** desktop Controller/Output status projection only; no mobile Flow UI and no new database enum.
**Acceptance:** `Image Generated`, `Video Generated`, `Ready Upload`, `Needs Manual Match`, and `Error` derive only from real manifest, stage, generated file, clip, batch, and upload-package state.

### P2-PROMPT-QUALITY-02 - Prompt anti-slop grounding guard
**Goal:** Prevent generated prompt packs and exported prompt TXT from drifting into generic product-agnostic prompt copy.
**Owner:** Codex
**Scope:** prompt generation contract, manifest prompt extraction, and tests only; no design advisor UI.
**Acceptance:** prompt copy must include reviewed product context, valid reference handles, active profile rules, and stage-specific instructions; generic filler or missing evidence fails validation before Flow handoff.

## Share Workspace Redesign Stream

Source spec: `docs/superpowers/specs/2026-05-23-share-workspace-redesign.md`.
Implementation plan: `C:\Users\Acer\.openclaude\plans\generic-weaving-narwhal.md`.

This section registers Share Workspace Redesign as an approved stream-specific spec for multi-page route implementation. The Phase 1 baseline in `docs/PRD_SOURCE_OF_TRUTH.md` remains unchanged: `/products/new` stays the entrypoint, mobile bottom navigation remains `Dashboard`, `Intake`, `Produk`, `Prompt`, and `Drive`, and Controller/Flow constraints remain governed by the existing locks.

Section lock:

- Share workspace is a new multi-page route: `/share` (platform picker) → `/share/[platform]` (product list) → `/share/[platform]?detail=[productId]&tab=[output|history]` (drawer).
- Product list is lintas semua affiliate profile (not isolated per workspace like `/products`).
- Drawer input requires affiliate URL before generate; affiliate URL is separate from product_url and only used for CTA in Gemini caption output.
- Generate creates batch in `share_generations` table; Output tab shows latest batch, History tab shows all versions with regenerate action.
- Mobile drawer is full-screen (NOT bottom sheet), matching product/prompt detail behavior.
- UI patterns reuse `/products` desktop table + mobile cards, `OperatorDetailDrawer`, `operator-detail-layout`, and prompt history regenerate flow.
- Implementation must be one micro-task at a time.
- Verification: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run smoke:e2e` when practical.

Implementation order:

1. `SHARE-001` - Database migration for share tables.
2. `SHARE-002` - Server library and contracts.
3. `SHARE-003` - Platform picker route.
4. `SHARE-004` - Product list route and component.
5. `SHARE-005` - Drawer input form.
6. `SHARE-006` - Drawer output and history tabs.
7. `SHARE-007` - Feature CSS and styling.
8. `SHARE-008` - Navigation and cleanup.
9. `SHARE-009` - E2E tests and verification.

### SHARE-001 - Database migration for share tables
**Goal:** Create `share_product_links` and `share_generations` tables with RLS owner policies.
**Owner:** OpenClaude
**Scope:** Migration file only; no server actions, UI, or routes.
**Acceptance:** 
- `share_product_links` table: `id` (uuid PK), `user_id` (uuid FK auth.users), `product_id` (uuid FK products), `affiliate_url` (text NOT NULL), `created_at`, `updated_at`. Unique constraint `(user_id, product_id)`. RLS policy allows owner CRUD.
- `share_generations` table: `id` (uuid PK), `user_id` (uuid FK auth.users), `product_id` (uuid FK products), `platform` (text: facebook | threads | x | pinterest), `angle` (text: benefit_focused | problem_solution | social_proof | urgency_scarcity | educational | storytelling), `variant_count` (int 1-4), `output_json` (jsonb), `status` (text: generating | generated | error), `error_message` (text nullable), `created_at`. Index `(user_id, product_id, platform, created_at DESC)`. RLS policy allows owner CRUD.
- Migration applies cleanly with `supabase db push` or MCP apply.
- Schema lock doc updated if necessary.

### SHARE-002 - Server library and contracts
**Goal:** Create server-side contracts, platform constants, and server actions for share workspace.
**Owner:** OpenClaude
**Scope:** `src/lib/share/`, `src/lib/server/share-*.ts` only; no UI or routes.
**Acceptance:**
- `src/lib/share/share-list-contract.ts`: URL state normalization, pagination contract (pattern: `src/lib/products/product-list-contract.ts`).
- `src/lib/share/share-platform.ts`: platform constants (facebook, threads, x, pinterest), labels, icon paths.
- `src/lib/server/share-generations.ts`: server actions for list, get-by-product-platform, generate, regenerate. Owner-scoped queries only.
- `src/lib/server/share-product-links.ts`: server actions for get, upsert affiliate URL. Owner-scoped queries only.
- TypeScript compiles, lint passes.

### SHARE-003 - Platform picker route
**Goal:** Rewrite `/share` as platform workspace picker with 4 platform cards.
**Owner:** OpenClaude
**Scope:** `src/app/share/page.tsx`, `src/app/share/share-platform-picker.tsx` only.
**Acceptance:**
- `/share` renders 4 platform cards: Facebook, Threads, X, Pinterest.
- Card layout: 2-column grid mobile (360-767), 3-4 column tablet/desktop (768+).
- Card visual follows tool picker pattern (like ai-media) using operator dashboard tokens.
- Click card → `router.push('/share/[platform]')`.
- Remove old `src/app/share/share-view.tsx` and `src/app/share/mock-data.ts` if still present.
- Verification: lint, typecheck, build pass.

### SHARE-004 - Product list route and component
**Goal:** Build `/share/[platform]` product list with real Supabase data, lintas semua affiliate profile.
**Owner:** OpenClaude
**Scope:** `src/app/share/[platform]/page.tsx`, `src/app/share/[platform]/share-product-list.tsx` only.
**Acceptance:**
- Server component validates platform param (facebook | threads | x | pinterest), fetches products lintas workspace, fetches affiliate links, fetches latest generation per product.
- Desktop (1024+): dense table like `/products`.
- Mobile (360-767): product cards like `/products`.
- Tablet (768-1023): hybrid pattern existing.
- Toolbar: search input, summary badge (item count, platform context), filter chips if needed.
- Status badge per product: `Perlu Link Affiliate`, `Siap Generate`, `Selesai`, `Error` (derived from affiliate_url presence and generation status).
- Pagination: keyset desktop, infinite scroll mobile (pattern: `/products`).
- Loading, empty, error states present.
- Click product → URL updates to `?detail=[productId]` (drawer opens).
- Verification: lint, typecheck, build pass.

### SHARE-005 - Drawer input form
**Goal:** Build drawer input form with product hero, Buka Produk button, affiliate URL field, angle/variant selectors, and generate CTA.
**Owner:** OpenClaude
**Scope:** `src/app/share/[platform]/share-detail-panel.tsx`, `src/app/share/[platform]/share-input-form.tsx` only.
**Acceptance:**
- Drawer opens when `searchParams.detail` exists and no generation exists yet (tabless input mode).
- Product hero: image, name, marketplace platform, status badge.
- **Tombol Buka Produk**: anchor to `product_url` with `target="_blank" rel="noopener"`.
- **Field Affiliate URL**: text input, wajib sebelum generate. Inline warning if empty.
- **Platform selector**: readonly/display-only, shows current platform from route.
- **Angle selector**: 6 options (Fokus Manfaat, Solusi Masalah, Bukti Sosial, Urgensi & Kelangkaan, Edukatif, Cerita).
- **Variant count**: 1-4.
- **CTA Generate**: disabled if affiliate_url empty.
- Generate action calls server action with `product_id`, `platform`, `angle`, `variant_count`, `affiliate_url`.
- After success, redirect to `?detail=[productId]&tab=output`.
- Drawer uses `OperatorDetailDrawer` (full-screen mobile, side panel desktop).
- Verification: lint, typecheck, build pass.

### SHARE-006 - Drawer output and history tabs
**Goal:** Build drawer output and history tabs with regenerate flow.
**Owner:** OpenClaude
**Scope:** `src/app/share/[platform]/share-output-tab.tsx`, `src/app/share/[platform]/share-history-tab.tsx` only.
**Acceptance:**
- Drawer switches to tabbed mode when generation exists: **Output** and **History** tabs.
- **Tab Output**: shows latest batch (latest `created_at` for product+platform). List varian caption with Copy and Manual Share actions per varian. Status badge per varian: angle, platform.
- **Tab History**: shows all batches for product+platform, ordered by `created_at DESC`. Layout follows prompt history pattern: list batch with timestamp, angle, variant count, preview caption. Action per batch: **Regenerate** (opens drawer input with batch settings pre-filled, operator can edit, then generate → new batch becomes latest Output, old batch stays in History).
- Tab navigation follows product detail tab pattern (stretch + scroll).
- Verification: lint, typecheck, build pass.

### SHARE-007 - Feature CSS and styling
**Goal:** Add token-based feature CSS for share workspace.
**Owner:** OpenClaude
**Scope:** `src/styles/05-features/share-workspace.css`, `src/app/globals.css` only.
**Acceptance:**
- `src/styles/05-features/share-workspace.css` created with token-based styling (pattern: `src/styles/05-features/prompt-history.css`).
- Import added to `src/app/globals.css` (NOT via `src/styles/index.css`): `@import '../styles/05-features/share-workspace.css';`.
- Remove or rename `src/styles/05-features/share-pack.css` if still present.
- Verification: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, lint, typecheck, build pass.

### SHARE-008 - Navigation and cleanup
**Goal:** Ensure Share nav entry is consistent and clean up prototype files.
**Owner:** OpenClaude
**Scope:** `src/components/operator/nav-config.ts`, cleanup of old share files.
**Acceptance:**
- `src/components/operator/nav-config.ts`: Share label consistent with nav pattern.
- Remove old prototype files if not already removed: `src/app/share/share-view.tsx`, `src/app/share/mock-data.ts`, `src/styles/05-features/share-pack.css`.
- Verification: lint, typecheck, build pass.

### SHARE-009 - E2E tests and verification
**Goal:** Add E2E smoke test for share workspace flow and verify all breakpoints.
**Owner:** OpenClaude
**Scope:** `tests/e2e/share-page-design.spec.ts` rewrite, manual breakpoint verification.
**Acceptance:**
- `tests/e2e/share-page-design.spec.ts`: covers platform picker → list → drawer input → generate (mock) → output → history → regenerate → mobile full-screen drawer behavior.
- Smoke test breakpoints: 360px, 768px, 1024px, 1280px.
- Manual verification: `/share` renders 4 cards, `/share/facebook` (dst) renders product list seamless with `/products`, drawer input with affiliate URL empty → generate disabled, generate success → URL changes to `?detail=...&tab=output`, tab History shows all batches, regenerate opens input with batch settings, mobile (360px) drawer is full-screen (not bottom sheet), close button closes drawer and returns to list, tombol Buka Produk opens `product_url` in new tab.
- Verification: `npm run smoke:e2e` or targeted test run, lint, typecheck, build pass.
- Document any blockers or verification gaps.
