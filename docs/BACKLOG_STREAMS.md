# Backlog Streams - MVP and Phase 2

## Phase Status

```text
Phase 1 MVP Baseline: PASS
Current Active Phase: Phase 2 Micro-Task Implementation
Phase 2 Lock Status: LOCKED FOR MICRO-TASK IMPLEMENTATION
```

The MVP streams below remain the Phase 1 completion model. Phase 2 streams are locked for ordered implementation but must not be marked complete until they receive task-backed implementation evidence.

## Stream Overview

| Stream | Name | Purpose | Owner |
|---|---|---|---|
| S0 | Project Control | Docs, AGENTS, repo rules, quality gates | Codex + User review |
| S1 | App Shell | Dashboard/Intake/Produk/Prompt/Drive nav, topbar Settings gear, route lock, settings/account shell, compatibility routes | Codex |
| S2 | Intake Workflow | `/products/new`, real image/screenshot uploads, Gemini analysis | Codex |
| S3 | Paket Prompt | Affiliate personas, workspace links, prompt rules, editor/generator, versioning, prompt context | Codex |
| S4 | Flow Control | global Flow pool, board, manifest, Windows Helper callback | Codex |
| S5 | Product Surface | Mobile workflow tabs, draft continue entrypoint, status-only bottom sheet, Metadata/Output/History detail surfaces | Codex |
| S6 | Pengaturan Hub | grouped native Settings overview, workspace, affiliate profile drawer, Gemini, Drive, Flow link, Account, helper token, picker grammar, nested routing, list drawer table/card grammar | Codex |
| S7 | Dashboard Analytics | secondary Gemini, Drive, prompt, output/import metrics | Codex |
| S8 | Hardening | build, tests, minimal copy, UX feedback, security pass | Codex + User review |

## Recommended Build Order

```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8
```

## First Vertical Slice

```text
Login
-> /products/new Intake
-> Produk list
-> /products/new upload Foto Produk Utama
-> Simpan Produk as DRAFT capture
-> complete at least one marketplace screenshot evidence
-> Analisis Metadata
-> Metadata review
-> active Affiliate Account readiness
-> Paket Prompt
-> Drive visual grid/gallery
-> Pengaturan via topbar gear
-> Pengaturan > Account pairing/token
-> Output package/history
```

## Audit Rule

Use `docs/BACKLOG_AUDIT.md` as the commit-backed evidence layer for stream progress.
`docs/MICRO_TASK_BACKLOG.md` is the summary index; do not mark a stream complete there unless the audit has a matching commit row.

## Phase 2 Locked Streams

| Stream | Name | Purpose | Status |
|---|---|---|---|
| P2-S1 | Prompt Batch Workbench | Bulk prompt production from truly prompt-ready products, with readiness filters and batch enqueue controls | Locked next |
| P2-S2 | AI Job Queue | Durable queue execution, quota-aware Gemini routing, retries, cancellation, and bulk progress tracking | Locked |
| P2-S5 | Scale Hardening | Server-side pagination/search, readiness projections, indexes, realtime or polling strategy, and operational dashboards | Locked |
| P2-S3 | Controller Reactivation | Desktop-only Flow Control reactivation with batch lanes, account recommendation, manifest export, and status reconciliation | Locked after prompt scale |
| P2-S4 | Windows Helper Ops | Operator-controlled helper run loop for manifest import, Chrome profile launch, output watch, rename, Drive upload, and callback | Locked after Controller lanes |

## Phase 2 Implementation Order

```text
P2-S1 -> P2-S2 -> P2-S5 -> P2-S3 -> P2-S4
```

Prompt production scale comes first because `Paket Prompt` is the current product output of the app. Controller and Helper work should follow after prompt bulk generation is reliable and observable.
