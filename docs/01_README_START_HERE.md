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
9. `docs/GOOGLE_DRIVE_FILE_SYSTEM_LOCK.md`
10. `docs/MICRO_TASK_BACKLOG.md`
11. `docs/SUPABASE_MCP_RUNBOOK.md`
12. `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

## MVP Core
The MVP is not a generic affiliate planner. It is an AI production control center for one operator.

Core flow:

1. Dashboard entrypoint.
2. Produk list.
3. Mobile-first intake in `/products/new`.
4. Live Gemini analysis from uploaded image bytes.
5. Metadata review.
6. Paket Prompt preview/edit/regenerate.
7. Desktop-only Flow Control in `/controller`.
8. Windows Helper handoff to Chrome profile + Google Flow URL.
9. Manual Google Flow generation by the user.
10. Helper rename/upload to Google Drive and metadata callback.
11. Output package and history.
12. Pengaturan hub, including `Pengaturan > Account` for Chrome pairing, App API Token, and sign out.

## Sprint Rule
Do not start broad feature work. Start with the locked vertical slice:

```text
Dashboard
-> /products
-> /products/new upload Foto Produk Utama + Screenshot Shopee + Screenshot TikTok
-> Analisis Gemini
-> Metadata review
-> /prompts Paket Prompt
-> /controller Flow Control on desktop
-> Windows Helper manifest/output callback
-> Output package/history
```

## Human Owner Responsibilities
The user must provide real product images, marketplace screenshots, workspace choices, affiliate profile details, Gemini keys, Supabase project access, Google Drive authorization, Google Flow account access, Windows Helper local config, manual Flow execution, video review, and manual upload to TikTok/Shopee.

Codex handles code and documentation implementation only.
