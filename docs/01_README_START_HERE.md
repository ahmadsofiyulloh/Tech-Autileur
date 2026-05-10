# 01 - Start Here Before Sprint

## Purpose
This folder is the implementation control pack for Codex CLI. It keeps the Phase awal MVP small, locked, and fast to ship.

## Read Order
Read these docs in order:

1. `AGENTS.md`
2. `docs/PRD_SOURCE_OF_TRUTH.md`
3. `docs/ARCHITECTURE_LOCK.md`
4. `docs/DATABASE_SCHEMA_LOCK.md`
5. `docs/DO_NOT_BUILD.md`
6. `docs/PROMPT_PIPELINE_LOCK.md`
7. `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
8. `docs/FLOW_BATCH_BRIDGE_LOCK.md`
9. `docs/FLOW_HELPER_DESKTOP_WORKFLOW.md`
10. `docs/GOOGLE_DRIVE_FILE_SYSTEM_LOCK.md`
11. `docs/BACKLOG_STREAMS.md`
12. `docs/BACKLOG_AUDIT.md`
13. `docs/MICRO_TASK_BACKLOG.md`
14. `docs/SUPABASE_MCP_RUNBOOK.md`
15. `docs/SMOKE_E2E_RUNBOOK.md`
16. `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

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
11. Pengaturan hub through the topbar Settings gear, including `Pengaturan > Account` for Chrome pairing, App API Token, and sign out.
12. Controller/Flow and Windows Helper execution remain retained backend/desktop surfaces, but are not primary Phase 1 mobile navigation.

## Sprint Rule
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
-> /settings grouped native list through topbar gear
-> Output package/history
```

## Human Owner Responsibilities
The user must provide real product images, marketplace screenshots, workspace choices, affiliate profile details, Gemini keys, Supabase project access, Google Drive authorization, Google Flow account access, Windows Helper local config, manual Flow execution, video review, and manual upload to TikTok/Shopee.

Codex handles code and documentation implementation only.
