# Intake Metadata Refactor Contract - 2026-05-07

## Status

Approved plan contract for the next implementation sequence. This document is docs-only source of truth for the Intake refactor before runtime changes begin.

## Purpose

Separate the lifecycle of capturing a product from the lifecycle of Gemini metadata readiness. A product can be safely saved as an intake draft while metadata analysis remains pending, running, ready, failed, or waiting for manual retry.

This prevents silent loss when Gemini is slow or fails, and prevents the UI from treating metadata success as the only proof that a product entered the system.

## Locked Decisions

- Use the existing schema first. No migration is approved for the first implementation wave.
- `Simpan Produk` and `Analisis Metadata` are separate operator actions.
- `Simpan Produk` is enabled when at least one `Foto Produk Utama` is available.
- A saved product remains `products.status = DRAFT` until a later explicit workflow transition.
- Source image availability is derived from Drive-backed image/evidence rows, not from `products.status`.
- Metadata readiness is derived from the intake session and analysis action state, not from `products.status`.
- `Analisis Metadata` requires the evidence needed by the Gemini vision contract: product image and at least one Shopee or TikTok screenshot.
- Gemini failure must not remove the saved product from the operator flow.
- After save, the operator stays on `/products/new`.
- After metadata analysis succeeds, the operator stays on `/products/new` for review/next action instead of being auto-redirected.
- `Buat Prompt` is blocked until metadata is reviewed/ready and Affiliate Profile prompt readiness passes.
- Affiliate Profile readiness does not block `Simpan Produk` or `Analisis Metadata`.
- Intake no longer exposes profile switching. One workspace/profile namespace is the active context.
- The former upload tab area becomes a compact active Affiliate Account card with readiness and edit shortcut.
- The active account edit shortcut opens the existing-style inline drawer from Intake.
- The drawer stays open after asset reanalysis succeeds or fails and shows inline feedback.
- Character preview only appears when `Lock Character` is ON.
- Environment preview only appears when `Lock Environment` is ON.
- Mobile preview upload layout uses three equal mini cards in one responsive row when space allows.
- Loading for metadata analysis uses preview/product skeleton treatment, not only a small generic spinner.
- Primary operator actions must stay visible when there is room; overflow is reserved for secondary actions on constrained mobile width.

## Lifecycle Contract

### Product Capture

Product capture means the operator has saved a product intake draft.

Minimum:

- at least one product image byte exists.
- product image bytes are uploaded to Google Drive.
- Supabase metadata relates the image/evidence to the saved product or intake record.
- product remains `DRAFT`.

Allowed before metadata:

- product appears in the Intake queue or product draft surface.
- operator can add missing screenshots.
- operator can retry metadata analysis after failure.
- operator can leave and return without losing the captured product.

Forbidden:

- do not mark metadata ready only because the product was saved.
- do not require Gemini success before creating durable product/intake records.
- do not auto-redirect to prompt generation immediately after save.

### Metadata Readiness

Metadata readiness is separate from product capture.

States:

- `metadata_pending`: product is saved but required analysis evidence is incomplete or analysis has not started.
- `metadata_generating`: Gemini metadata analysis is running.
- `metadata_ready`: Gemini returned parseable metadata and the operator can review it.
- `metadata_failed`: Gemini or parsing failed; product remains recoverable and retry is visible.
- `metadata_needs_manual_review`: metadata exists but still needs operator review before prompt generation.
- `metadata_reviewed`: reviewed metadata is ready for prompt generation.

Implementation must derive these states from existing records:

- `products.status = DRAFT` for captured but unfinished product workflow.
- `product_images` and Drive references for source image availability.
- `product_intake_sessions.status`, `reviewed_metadata_json`, and parsed metadata payloads for readiness.
- request/action pending state for in-flight generation.

Do not rely on `ai_tasks.product_id` or `ai_tasks.intake_session_id` for first-wave UI readiness until the actual database contract is explicitly reconciled.

## Intake UI Contract

`/products/new` remains the primary Intake route.

Mobile layout:

- one unified upload/product/metadata surface.
- no tab split between product upload and marketplace screenshot upload.
- three equal mini preview cards:
  - `Foto Produk Utama`
  - `Screenshot Shopee`
  - `Screenshot TikTok`
- mini cards must not overflow on narrow mobile screens; they may shrink or wrap only if required by viewport width.
- preview cards show uploaded/local preview images when available and Drive-backed preview images after save when available.
- saved draft products appear as a compact product queue/drive-like surface when metadata is pending or failed.
- metadata generation shows skeleton preview cards or product-card skeletons near the affected item.
- empty and error states stay short and operational.

Action contract:

- primary action before capture: `Simpan Produk`.
- primary action after capture and at least one marketplace screenshot evidence: `Analisis Metadata`.
- retry action after failure: same analysis action, with visible failed state.
- prompt action appears only when metadata and profile readiness allow it.

## Affiliate Account Contract In Intake

The Intake surface must not offer profile switching.

The former selector/carousel slot becomes a compact active account card:

- shows the active Affiliate Account identity.
- shows avatar or fallback initials using existing preview behavior.
- shows profile/prompt readiness.
- opens inline drawer for editing the active profile.
- does not expose a horizontal carousel.
- does not expose "Pilih" or "Aktif" switching actions.

If no active profile can be resolved, show a short blocking state for prompt readiness only. Product save and metadata analysis remain usable when their own inputs are valid.

## Affiliate Drawer Contract

The inline profile drawer reused from Intake and Settings must remain mobile-first:

- drawer is the edit surface.
- no notes/helper paragraphs are introduced.
- lock controls use native switch-row styling consistent with the Product bottom sheet.
- Character preview grid is rendered only while `Lock Character` is ON.
- Environment preview grid is rendered only while `Lock Environment` is ON.
- reanalysis actions show pending, success, and failed inline fallback.
- drawer does not close automatically after reanalysis success.
- Drive reference controls remain scoped to the existing data contract.

If seed-lock Drive settings require new fields or schema, document it as a follow-up task instead of inventing data model changes.

## Action And Status Polish Contract

Action placement:

- primary actions are shown directly.
- secondary actions may move into overflow on narrow mobile width.
- a single frequently used action must not be hidden in overflow when there is room.

Inline status:

- status copy must be short.
- card status rows must avoid overlap on mobile.
- long context text must truncate or line-clamp safely.
- badge and context text need consistent spacing.
- fixes should use reusable card/list patterns where possible, not one-off string patches.

## Product Detail Metadata Tab

The product detail `Metadata` tab shows screenshot OCR only. It uses the same read-only copy field pattern as Prompt Detail, with `Salin` actions, and excludes technical audit data such as Drive IDs, paths, schema versions, task IDs, raw JSON, timestamps, and extraction diagnostics.

## Micro-Task Sequence

### T0 - Docs-only refactor contract update

Goal: lock this contract and align source-of-truth docs before runtime changes.

Allowed files: docs only.

Forbidden files: `src/**`, `tests/**`, migrations, package manifests, generated assets.

Acceptance:

- this contract exists.
- core docs reference the separated save-vs-metadata lifecycle.
- backlog lists the implementation sequence.
- no runtime code changes are included.
- `git diff --check` passes.

### T1 - Intake lifecycle state separation

Goal: make product capture durable before Gemini metadata success.

Likely files:

- `src/app/intake/actions.ts`
- `src/lib/server/intake.ts`
- `src/app/products/new/page.tsx`
- `src/app/products/new/intake-workflow-form.tsx`

Acceptance:

- product can save as `DRAFT` with product image only.
- Gemini failure does not discard the saved draft.
- metadata readiness is not inferred from product capture.

### T2 - Intake preview grid and unified surface

Goal: replace upload tabs with a compact three-card preview grid and product queue/readiness surface.

Likely files:

- `src/app/products/new/intake-workflow-form.tsx`
- `src/components/operator/image-preview-upload-card.tsx`
- `src/components/operator/loading-skeleton.tsx`

Acceptance:

- mobile renders the three mini cards without overflow.
- saved/remote preview images display where Drive preview data exists.
- no profile carousel remains in the upload flow.

### T3 - Metadata analysis fallback and skeleton

Goal: make analysis pending/success/failure visible and retryable.

Acceptance:

- generating state uses preview/product skeletons.
- failed state keeps product visible.
- retry is explicit.
- success shows metadata review/next action without auto-closing or auto-redirecting.

### T4 - Active account card in Intake

Goal: replace profile switching with active account readiness and edit shortcut.

Acceptance:

- one compact active account card is shown.
- no profile switching carousel/actions remain in Intake.
- prompt readiness is visible.

### T5 - Affiliate drawer lock and reanalysis polish

Goal: align drawer lock UI and fallback behavior.

Acceptance:

- preview sections are conditional by lock toggle.
- reanalysis feedback is inline.
- drawer stays open after success/failure.
- no unapproved seed-lock schema changes are added.

### T6 - Action button and inline status polish

Goal: keep primary actions visible and prevent mobile card status overlap.

Acceptance:

- prompt TXT/profile setting actions are direct when space allows.
- status context truncates or line-clamps safely.
- product/intake/metadata card status patterns stay consistent.

### T7 - Regression QA and docs progress update

Goal: verify the refactor and update progress evidence.

Acceptance:

- lint, typecheck, and build pass or blockers are documented.
- targeted E2E/smoke checks cover save, retry, failed metadata, readiness, and drawer behavior.
- progress docs are updated only after runtime evidence exists.

## Verification Expectations

Docs-only:

```bash
git diff --check
```

Runtime tasks:

```bash
npm run lint
npm run typecheck
npm run build
```

Targeted smoke coverage after runtime changes:

- save product with only product image.
- add screenshots after save.
- run metadata analysis.
- force or simulate Gemini failure and retry.
- verify prompt CTA readiness.
- verify affiliate drawer reanalysis feedback.
- verify mobile layout at narrow viewport.

## Explicit Non-Goals

- No new route for Metadata.
- No schema migration in the first implementation wave.
- No global workspace picker.
- No profile switching carousel in Intake.
- No per-prompt character/environment override.
- No new background-reference asset slot.
- No unapproved helper paragraphs or marketing copy.
- No Google Drive deletion or file-moving side effects.
- No claims of visual parsing without image bytes.
