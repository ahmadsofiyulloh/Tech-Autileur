# 01 - Start Here Before Sprint

## Purpose
This folder is the implementation control pack for Codex CLI. It keeps the Phase 1 MVP baseline locked while Phase 2 is implemented through approved micro-tasks.

## Phase Status

```text
Phase 1 MVP Baseline: PASS
Current Active Phase: Phase 2 Micro-Task Implementation
Phase 2 Lock Status: LOCKED FOR MICRO-TASK IMPLEMENTATION
```

Phase 1 pass means the mobile-first MVP baseline is accepted as the foundation for Phase 2. It does not mean the app is production-scale for thousands of products or automated video execution.

Phase 2 is now locked as an implementation sequence. Do not implement broad Phase 2 systems; implement only the next approved micro-task in `docs/MICRO_TASK_BACKLOG.md`.

## Read Order
Read these docs in order:

1. `AGENTS.md`
2. `docs/PHASE_1_PASS_AUDIT_2026_05_15.md`
3. `docs/PHASE_2_ARCHITECTURE_LOCK.md`
4. `docs/PHASE_2_ARCHITECTURE_DISCUSSION.md`
5. `docs/PRD_SOURCE_OF_TRUTH.md`
6. `docs/ARCHITECTURE_LOCK.md`
7. `docs/DATABASE_SCHEMA_LOCK.md`
8. `docs/DO_NOT_BUILD.md`
9. `docs/PROMPT_PIPELINE_LOCK.md`
10. `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
11. `docs/FLOW_BATCH_BRIDGE_LOCK.md`
12. `docs/FLOW_HELPER_DESKTOP_WORKFLOW.md`
13. `docs/GOOGLE_DRIVE_FILE_SYSTEM_LOCK.md`
14. `docs/BACKLOG_STREAMS.md`
15. `docs/BACKLOG_AUDIT.md`
16. `docs/MICRO_TASK_BACKLOG.md`
17. `docs/SUPABASE_MCP_RUNBOOK.md`
18. `docs/SMOKE_E2E_RUNBOOK.md`
19. `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

## Stream-Specific Feature Docs
Read these only when implementing matching stream micro-tasks:

- `docs/AI_MEDIA_LAB_PRD.md` - approved AI Media Lab stream PRD for frontend-first Magnific API testing work.
- `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md` - current frontend dummy implementation audit for the AI Media Lab branch state.

Stream-specific docs extend the app only through approved micro-tasks. They must not override the Phase 1 baseline route, mobile navigation, storage, security, or Flow constraints unless a later lock explicitly approves that change.

## MVP Core
The MVP is not a generic affiliate planner. It is an AI production control center for one operator.

Core flow:

1. `/products/new` Intake entrypoint.
2. Mobile upload/capture for product image, with product capture saved before metadata analysis.
3. At least one Shopee or TikTok screenshot completes the evidence required for Gemini metadata analysis.
4. Active Affiliate Account readiness is shown in Intake without profile switching.
5. Live Gemini analysis from uploaded image bytes.
6. Metadata review.
7. Produk list review.
8. Paket Prompt generated output, copy-ready fields, regenerate, and history.
9. Drive visual grid/gallery review with bottom-sheet preview.
10. Output package and history when available.
11. Pengaturan hub through the Profile avatar menu Settings action, with `Pengaturan > Account` for Chrome pairing and App API Token.
12. Controller/Flow and Windows Helper execution remain retained backend/desktop surfaces, but are not primary Phase 1 mobile navigation.

## Phase 1 Baseline Rule
Do not start broad feature work. Start with the locked vertical slice:

```text
/products/new Intake
-> upload Foto Produk Utama
-> Simpan Produk as durable DRAFT capture
-> complete at least one marketplace screenshot evidence
-> Analisis Metadata with Gemini
-> Metadata review
-> active Affiliate Account readiness handoff
-> /products visual card list
-> /prompts Paket Prompt
-> /drive visual grid/gallery
-> /settings grouped native list through Profile avatar menu
-> Output package/history
```

## Phase 2 Working Rule

Phase 2 implementation follows this locked order:

```text
Prompt production scale
-> AI job queue
-> large dataset hardening
-> Controller reactivation
-> Windows Helper operational loop
```

`docs/PHASE_2_ARCHITECTURE_LOCK.md` is the Phase 2 source of truth. `docs/PHASE_2_ARCHITECTURE_DISCUSSION.md` remains historical context only. Any implementation must still be one micro-task at a time and must not override Phase 1 constraints without an approved lock update.

## Human Owner Responsibilities
The user must provide real product images, marketplace screenshots, workspace choices, affiliate profile details, Gemini keys, Supabase project access, Google Drive authorization, Google Flow account access, Windows Helper local config, manual Flow execution, video review, and manual upload to TikTok/Shopee.

Codex handles code and documentation implementation only.
