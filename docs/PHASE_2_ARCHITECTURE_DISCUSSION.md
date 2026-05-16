# Phase 2 Architecture Discussion

## Status

`SUPERSEDED BY docs/PHASE_2_ARCHITECTURE_LOCK.md`.

This document is historical context. The current Phase 2 source of truth is `docs/PHASE_2_ARCHITECTURE_LOCK.md`.

## Goal

Phase 2 should make the app efficient for large product volumes while keeping the operator in control.

The first priority is prompt production scale because the current product output of the app is `Paket Prompt`. Controller and video execution should follow only after prompt generation is reliable, queue-backed, reviewable, and observable at bulk scale.

## Non-Negotiable Constraints

- Keep the app single-owner/operator.
- Keep Supabase as metadata source of truth.
- Keep Google Drive as file/asset source of truth.
- Keep large image/video bytes out of Supabase Storage.
- Keep Gemini keys, Google secrets, service role keys, refresh tokens, and helper secrets server-only or local-only as already locked.
- Do not auto-click, auto-select, or auto-submit Google Flow.
- Do not auto-upload to TikTok or Shopee.
- Do not add a mobile Flow queue manager as a primary mobile surface.
- Do not turn Flow Accounts into a separate Settings CRUD surface.
- Do not store Chrome profile paths, helper local folder paths, or helper Drive OAuth tokens in Supabase.

## Proposed Phase 2 Streams

### P2-S1 - Prompt Batch Workbench

Create a desktop-first operational surface for bulk prompt production.

The workbench should show products by derived readiness, not by raw `products.status` alone:

- `Needs Evidence`
- `Needs Metadata`
- `Needs Review`
- `Ready for Prompt`
- `Prompt Queued`
- `Prompt Generated`
- `Prompt Failed`

The operator should be able to filter, select, and enqueue only products that are truly `Ready for Prompt`. The UI should not encourage generating prompts from every `DRAFT` row.

### P2-S2 - AI Job Queue and Bulk Prompt Generation

Move prompt generation from one-at-a-time UI execution toward durable queue execution.

The queue should support:

- bulk enqueue from prompt-ready products.
- per-job status, retry count, error message, and selected Gemini key.
- quota-aware scheduling by `project + model`.
- safe cancellation before execution.
- resume/retry for failed or waiting jobs.
- progress visible without keeping a prompt detail page open.

Gemini Batch API may be evaluated for large, non-urgent prompt jobs. If adopted, it must preserve the existing prompt pack contract, version history, parser validation, and per-product result mapping.

### P2-S3 - Controller Reactivation

Reactivate `/controller` as a desktop-only Flow Control surface after prompt bulk production is stable.

Controller should remain queue-first and keep the locked board columns:

```text
Prompt Siap
Sedang Flow
Output Masuk
Selesai
```

Controller should support account recommendation, batch creation, manifest export, and status reconciliation. It must not claim live Google Flow progress unless helper or another approved integration actually reports that state.

Controller stage execution is locked to a manual-assisted model for the first foundation task:

- `FIRST_FRAME`: image generation input uses `@character`, `@environment`, and `@product`.
- `LAST_FRAME`: image generation input uses only the imported first frame.
- `VIDEO`: video generation input uses only the imported first and last frame.
- One Flow account maps to one Chrome profile lane in Windows Helper local config.
- The operator chooses which lanes run; the app/helper does not click, upload, or submit inside Google Flow.

### P2-S4 - Windows Helper Operational Loop

Document and harden the helper loop as an operator-controlled desktop companion:

- import/read manifest JSON.
- resolve `flow_account_code` to local Chrome profile path from local config.
- open the matching Chrome profile and Google Flow URL.
- watch the local output folder resolved from `helper_output_folder_key`.
- rename output files using the manifest pattern.
- upload output files directly to Google Drive with local OAuth.
- post metadata callback to the app with App API Token.

The helper remains a bridge. It must not automate Google Flow controls.

### P2-S5 - Scale Hardening

Prepare the app for thousands of products and prompt packs:

- server-side pagination and search for large product, prompt, Drive, and batch lists.
- readiness projection or cached workflow summary for product rows.
- indexes for high-volume filters and queue queries.
- operational dashboards for queue status, Gemini quota pressure, prompt failures, and helper callbacks.
- Realtime or polling strategy chosen per surface based on scale.

## Architectural Questions To Resolve

- Should bulk prompt generation use only the existing `ai_tasks` table first, or introduce a dedicated prompt batch table?
- Should prompt readiness be stored as a projection table/column or computed from current product, intake, image, profile, and prompt state?
- What is the maximum safe prompt batch size for the operator workflow: 25, 50, 100, or quota-derived?
- Should Gemini Batch API be Phase 2.1 after local queue execution, or part of the first Phase 2 architecture lock?
- Should `/prompts` become the primary bulk workbench, or should a new desktop-only sub-surface handle bulk operations?
- What should be the exact approval model for high-confidence metadata: manual review only, bulk approve, or confidence-gated review?
- What is the first helper UX target: manifest import only, output import reliability, or full local helper status reporting?

## Recommended Sequencing

1. Lock Phase 2 architecture decisions in a dedicated source-of-truth update.
2. Build prompt readiness projection and server-side list scalability.
3. Add prompt batch enqueue and queue runner.
4. Add bulk prompt progress, retry, and failure review.
5. Reactivate desktop `/controller` with retained Flow batch rules.
6. Harden Windows Helper operational loop and callback reconciliation.
7. Add operational analytics after the queue and helper loops emit reliable data.

## Success Criteria Draft

Phase 2 should be considered successful when:

- thousands of products can be browsed and filtered without relying on 200-row client-side list caps.
- the operator can generate prompts in controlled batches without opening every product manually.
- failed prompt jobs are visible, retryable, and traceable to the product and Gemini key/quota context.
- generated prompt packs remain versioned and contract-valid.
- Flow batches can be prepared faster while Google Flow execution remains manual and controlled.
- helper-imported outputs map back to prompt packs, clip jobs, products, and Drive folders without manual spreadsheet tracking.
