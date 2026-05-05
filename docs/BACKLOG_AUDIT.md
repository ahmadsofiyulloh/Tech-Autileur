# Backlog Audit - Commit-Backed Implementation Ledger

## Purpose
This document is the evidence layer for backlog progress. Use it before editing `docs/MICRO_TASK_BACKLOG.md` or any stream note. If a status change cannot be tied to a commit here, do not mark it complete.

## Rules
- Commit hashes are the source of truth.
- Task labels in commit subjects are direct evidence.
- Older commits without task labels are legacy evidence and must be labeled as such.
- Docs-only checkpoints are support notes, not feature completion by themselves.
- `48ff168` is a dirty checkpoint artifact and is excluded from task completion evidence.

## Task-Tagged Commit Ledger

| Date | Commit | Task IDs | Scope note |
|---|---|---|---|
| 2026-05-03 | b5a7d65 | S0-001, S6-005, S8-004 | Locked phase awal surface grammar and backlog guards. |
| 2026-05-03 | 774f6a3 | S6-003, S8-001 | Added picker primitive and compact UI copy. |
| 2026-05-03 | 118e6ff | S6-001, S6-002 | Wired settings tool surfaces. |
| 2026-05-03 | 6d2d1bd | S2-001, S2-003 | Enforced upload intake and live Gemini review. |
| 2026-05-03 | 6c0f845 | S3-002 | Aligned the prompt pack editor contract. |
| 2026-05-03 | 487b2da | S4-002, S4-003 | Added account recommendation and controller board. |
| 2026-05-03 | ab03c90 | S5-001, S5-002 | Added product detail history and output package. |
| 2026-05-03 | 22a5a02 | S7-001 | Added phase awal dashboard analytics. |
| 2026-05-03 | 8684994 | S3-002, S8-001 | Preserved prompt regen context. |
| 2026-05-03 | b0da23e | S2-001, S2-003 | Required Shopee/TikTok intake and auto-linked product. |
| 2026-05-03 | a6f2add | S5-001, S6-005 | Added searchable product master list. |
| 2026-05-03 | 178e62f | S4-001, S4-002, S4-003 | Hardened Flow account pool and batch confirmation. |
| 2026-05-03 | fcab43b | S6-001, S6-002, S6-004 | Split settings hub into nested sections. |
| 2026-05-03 | 01f248b | support | Marked implemented backlog progress. |
| 2026-05-03 | 66c09ee | support | Synced workbench typography and UI baseline. |
| 2026-05-03 | 3a0c8a2 | S1-001, S1-003 | Added route-aware operator shell. |
| 2026-05-03 | 9265327 | S8-001 | Compacted operational surfaces and workbench styling. |
| 2026-05-03 | ab85b1d | S4-001, S4-002 | Surfaced controller Flow account panel. |
| 2026-05-03 | 0d1e1df | S7-001 | Added dashboard action rail and intake review counts. |
| 2026-05-03 | 8538b3a | S3-002 | Deep-linked the prompt editor from intake and product detail. |
| 2026-05-03 | 6d22087 | S4-004 | Exported flow batch manifest for helper bridge. |
| 2026-05-03 | b40bf74 | support | Provisioned workspace drive tree. |
| 2026-05-03 | 226db32 | S2-002 | Uploaded evidence files to Google Drive. |
| 2026-05-03 | 1d83fb3 | support | Streamlined prompt pack editor. |
| 2026-05-03 | 454d6f4 | S4-005 | Accepted helper metadata callback. |
| 2026-05-03 | 7b4cf7f | support | Reused loaded flow account data. |
| 2026-05-03 | 9f88d54 | S3-003 | Added top-level affiliate profile relations. |
| 2026-05-03 | 9013915 | S6-003 | Applied the shared picker grammar. |
| 2026-05-03 | 84384e1 | S6-006 | Rewrote the affiliate profile drawer. |
| 2026-05-03 | 37af14d | S6-003 | Refined picker grammar and controller flow picker. |
| 2026-05-03 | c9adddc | S6-006 | Hardened affiliate profile drawer assets. |
| 2026-05-03 | 0677040 | support | Hardened responsive shell layout. |
| 2026-05-04 | 32c5a0c | S8-002 | Added Playwright smoke E2E harness. |
| 2026-05-04 | e2c7574 | S8-003 | Hid operator codes and legacy notes. |
| 2026-05-04 | c18cf47 | support | Adapted login searchParams handling. |
| 2026-05-04 | 26c26f8 | VIS-001..VIS-006 | Shipped the bundled mobile-first visual PWA sync. See `docs/VISUAL_PWA_PROGRESS_2026_05_04.md` for the visual snapshot. |
| 2026-05-04 | 11efa04 | VIS-003, S6-006 | Reused the shared image preview upload card across intake and affiliate profile drawers; refreshed smoke assertions. |
| 2026-05-04 | d7e86bc | S2-002, S2-003 | Hardened intake upload parsing and raised the server action upload limit for real file bodies. |
| 2026-05-05 | db97145 | S6-008, S6-009 | Moved Google Drive connect into the settings overview and retired `/settings/drive` as a visible surface. |
| 2026-05-05 | ec8e735 | S8-004 | Removed duplicated KPI tiles from prompt editor and prompt detail surfaces. |
| 2026-05-05 | 6698a6e | S6-007 | Converted Gemini settings into a multi-key list-card surface with drawer CRUD and disable action. |
| 2026-05-05 | 9fdd240 | support | Added PWA install card, shared primitives, and loading states. |
| 2026-05-05 | 4488a71 | S2-002, S2-003, S3-002, S5-001, S5-002 | Wired drive previews and tracked prompt generation. |
| 2026-05-05 | 54f4a60 | S6-010 | Added Gemini usage overview and settings sync. |
| 2026-05-05 | ca35faa | S2-003, S3-002 | Finished quota-aware intake Gemini routing. |
| 2026-05-05 | 765eb87 | S8-002 | Refreshed mobile shell and PWA install smoke coverage. |
| 2026-05-05 | 192db71 | S2-003 | Created marketplace sources from vision evidence. |
| 2026-05-05 | 731a46d | S6-010, S2-003 | Added shared Gemini routing and quota-aware intake hardening. |
| 2026-05-05 | 1d7f55a | S8-005 | Hardened mobile Drive long-press selection, synced the light mobile themeColor, and stabilized the smoke assertion path. |
| 2026-05-05 | 0ae6a76 | S6-011 | Added owner FK indexes for Gemini usage event joins. |
| 2026-05-05 | f6d3c2b | S6-012 | Hardened `gemini_api_key_secrets` with a deny-all client policy and revoked public EXECUTE on exposed helper functions. |

## Legacy Foundation Checkpoints

These commits predate the task-tagged commit convention but still document actual progress that later tasks build on.

- `0529a6b` - legacy evidence for `S1-002` route compatibility and redirects.
- `13d613f` - legacy evidence for `S3-001` affiliate profile settings foundation.
- `c51735f` - legacy evidence for `S3-001` prompt personalization wiring.
- `41db0f4` - legacy groundwork for workspace-scoped product flow.
- `5c6015c` - legacy groundwork for intake workflow and product detail tabs.
- `9bff93f` and `49b3bd3` - early operator shell groundwork.
- `b2d11d4` - mobile intake foundation.
- `6012b7b` - prompt pack affiliate profile indexes.

## Support Notes

- `48ff168` is a dirty checkpoint artifact and is not used as backlog evidence.
- `c7ac450` syncs the lock docs and operator guidance after the current worktree cleanup.
- `93eb5bf` restores the visual PWA shell and operational surfaces after the revert checkpoint.
- `24d5a1b` refreshes the lock docs and backlog for the current repo state; it is a support checkpoint, not feature completion.
- `11efa04` and `d7e86bc` are follow-up commits on already-completed tasks; they do not change the current backlog completion snapshot.
- `2ca104d` and `66c09ee` are docs and baseline sync checkpoints, not feature completion by themselves.
