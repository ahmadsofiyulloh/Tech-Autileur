# Phase 2 Architecture Lock

## Status

`LOCKED FOR MICRO-TASK IMPLEMENTATION`.

Locked on 2026-05-15 after Phase 1 MVP baseline pass. This lock promotes the Phase 2 discussion brief into an implementation sequence, but it does not approve broad feature work. Every Phase 2 change still lands as one micro-task with its own acceptance criteria.

## Goal

Make the app efficient for large product volumes while keeping the single operator in control.

Phase 2 priority order is locked:

```text
Prompt production scale
-> AI job queue
-> large dataset hardening
-> Controller reactivation
-> Windows Helper operational loop
```

Prompt production stays first because the current product output is `Paket Prompt`. Controller and Google Flow execution must not become the primary workstream until prompt generation is bulk-ready, queue-backed, reviewable, and observable.

## Non-Negotiable Constraints

- Keep the app single-owner/operator.
- Keep Supabase as metadata source of truth.
- Keep Google Drive as file/asset source of truth.
- Keep large image/video bytes out of Supabase Storage.
- Keep Gemini keys, Google secrets, service role keys, refresh tokens, and helper secrets server-only or local-only.
- Do not auto-click, auto-select, or auto-submit Google Flow.
- Do not auto-upload to TikTok or Shopee.
- Do not add a mobile Flow queue manager as a primary mobile surface.
- Do not turn Flow Accounts into a separate Settings CRUD surface.
- Do not store Chrome profile paths, helper local folder paths, or helper Drive OAuth tokens in Supabase.
- Do not bypass Gemini, Google Flow, Google Drive, TikTok, Shopee, or browser quota/rate limits.
- `alchaincyf/huashu-design` is a workflow reference only. It is not a dependency, code source, asset source, export pipeline, or approved product feature.
- Do not add huashu-style video editor features, PPT export, HTML animation engine, design advisor UI, SFX/BGM/TTS tooling, or design variation playgrounds.

## Huashu-Inspired Workflow Discipline

The approved adaptation is process discipline only:

- Docs-first: before implementation, each micro-task must state assumptions, target behavior, and out-of-scope boundaries.
- Asset/evidence protocol: Prompt Pack, Flow batch, and manifest readiness must be grounded in real product evidence from Drive/Supabase metadata, reviewed Gemini metadata, Bulk Import approved metadata, and active Affiliate Profile assets.
- Stage discipline: `FIRST_FRAME`, `LAST_FRAME`, and `VIDEO` remain explicit stages and must not be collapsed into a generic clip status.
- Anti-slop: generated prompt copy must stay product-specific and reference grounded; it must not become generic product-agnostic AI prompt text.
- Export verification: manifest/helper output must be semantically validated and reconciled before it is treated as production-ready.

Desktop production flow target:

```text
Prompt Ready
-> Batch Setup
-> Manifest Export
-> Helper Prep
-> Manual Flow Run
-> Output Import
-> Reconcile / Close
```

Operator-facing status target for later Controller/Output polish:

```text
Image Generated
Video Generated
Ready Upload
Needs Manual Match
Error
```

These are presentation targets derived from existing batch, stage, clip, generated file, and upload-package state. They do not approve new database enums in this docs task.

## Locked Decisions

### P2-S1 - Prompt Batch Workbench

- `/prompts` becomes the desktop-first bulk prompt workbench while preserving the existing mobile prompt list behavior.
- Readiness is derived from actual product, intake, image, metadata review or approved metadata source, affiliate profile, and prompt pack state; do not use raw `products.status` alone.
- Initial readiness labels are locked: `Needs Evidence`, `Needs Metadata`, `Needs Review`, `Ready for Prompt`, `Prompt Queued`, `Prompt Generated`, `Prompt Failed`.
- Bulk enqueue accepts only `Ready for Prompt` rows.
- Initial batch size default is `25`, maximum `50`, and Gemini quota pressure may lower the effective runnable count.
- Gemini OCR/Vision metadata still requires operator review in the first Phase 2 implementation.
- Bulk Import scraping metadata with `schema_version: "bulk_import_v1"` is the approved seed source, but it is not enough by itself for prompt readiness. Bulk Import must call Gemini metadata enrichment after product/image/source creation, then auto-review only when all Prompt Essentials are non-empty.

### P2-S2 - AI Job Queue

- Use the existing `ai_tasks` table first for prompt generation jobs.
- Do not introduce Supabase Queues or a dedicated prompt batch table in the first queue wave.
- Gemini Batch API is deferred to a later P2.1 evaluation and must not replace the existing prompt pack contract.
- Queue behavior must support enqueue, running, retry, cancel-before-run, failure reason, selected Gemini key, and progress visible away from prompt detail pages.

### P2-S5 - Scale Hardening

- Add server-side pagination/search before relying on client-side 200-row caps.
- Start with computed readiness projection from existing tables.
- Add cached projection tables or extra indexes only after query evidence shows they are needed.
- Realtime is allowed only where it improves operational feedback; polling is acceptable for large list stability.

### P2-S3 - Controller Reactivation

- `/controller` returns only as a desktop Flow Control surface after P2-S1 and P2-S2 are stable.
- Mobile nav remains `Dashboard`, `Intake`, `Produk`, `Prompt`, `Drive`.
- The legacy board status buckets remain for compatibility: `Prompt Siap`, `Sedang Flow`, `Output Masuk`, `Selesai`.
- The final desktop production UX target is a horizontal stepped workflow, not a four-grid board.
- First reactivation is read-only stage lanes over real Flow batch/helper state; mutating controls return in later micro-tasks.
- Stage execution remains manual-assisted: `FIRST_FRAME`, `LAST_FRAME`, `VIDEO`.
- One Flow account maps to one Chrome profile lane through Windows Helper local config only.
- `/controller` must operate inside the active Affiliate Profile internal workspace namespace. Prompt rows, batch setup, manifest export, stage lanes, and reconciliation must not mix products or prompt packs from another active workspace.
- Controller UI polish from `docs/codex-controller-polish-tasks.md` is presentation-only and must be adapted through `docs/UI_SHELL_REBRAND_LOCK.md` before runtime coding. The current runtime targets are `ControllerWorkflowStepper`, `ControllerManifestPopover`, `BatchCard`, `FlowAccountSupportPanel`, `BatchSelectionCard`, `StatusBadge`, Controller loading, and Controller mobile fallback. Polish must not change Controller server queries, mutations, manifest semantics, helper callbacks, workspace isolation, or desktop-only scope.

### P2-S4 - Windows Helper Operational Loop

- Helper reads manifest v2 and prepares stage prompt files from `stage_jobs[]`.
- Helper may open the mapped Chrome profile and Flow URL.
- Helper may watch local output folders, rename files, upload to Drive, and callback the app.
- Helper must not click, select, upload into, or submit inside Google Flow automatically.
- First helper hardening target is reliable stage pack/export and callback reconciliation, not full local helper status telemetry.
- Manifest export requires semantic validation before the helper treats the batch as runnable: schema version, stage order, dependencies, prompt text, input handles, Drive output target, helper output key, Flow account code, lane label, and active workspace context must be coherent.

## Micro-Task Order

0. `P2-S3-001A` - Stage-aware manifest foundation, already landed as a backend/doc foundation before this lock.
1. `P2-LOCK-01` - Phase 2 architecture implementation lock.
2. `P2-S1-001` - Prompt readiness projection foundation.
3. `P2-S1-002` - Desktop Prompt Batch Workbench.
3B. `P2-S1-002B` - Bulk Import auto-reviewed prompt handoff.
4. `P2-S2-001` - AI task queue prompt enqueue contract.
5. `P2-S2-002` - Queue runner and retry/cancel behavior.
6. `P2-S5-001` - Large dataset pagination/search hardening.
7. `P2-S3-001B` - Controller read-only stage lanes.
8. `P2-S4-001A` - Helper stage pack export contract.
9. `DOCS-HUASHU-ADAPT-00` - Workflow-only huashu adaptation lock.
10. `DOCS-HUASHU-ADAPT-01` - Desktop production flow acceptance criteria.
11. `P2-S4-001B` - Manifest semantic validation and helper readiness gate.
12. `P2-S3-001C` - Multi Chrome profile controlled run workflow.

## Acceptance

Phase 2 lock is satisfied when source-of-truth docs agree that:

- Phase 1 remains the mobile-first MVP baseline.
- Phase 2 is implementation-locked only through the sequence above.
- Prompt scale and queue work precede full Controller reactivation.
- Controller and Helper remain manual-assisted and desktop-only.
- All future Phase 2 runtime changes are decomposed into micro-tasks before implementation.
