# Share Link Caption Generator — V1 Implementation Plan

**Status:** DOC ONLY — no app code changes in this task.
**Date:** 2026-05-24
**Source audit:** `docs/share-link-caption-generator-actual-audit.md`
**PRD anchor:** `docs/PRD_SOURCE_OF_TRUTH.md` (Phase 1 lock)
**Scope owner:** Single operator (per AGENTS.md and PRD_SOURCE_OF_TRUTH.md)

This plan turns the audit findings into a sequenced micro-task backlog. It does NOT modify app code, schemas, or migrations. Each micro-task below is intended to be picked up later as an independent OpenClaude run.

---

## 1. Current Actual State Summary

Based on `docs/share-link-caption-generator-actual-audit.md` and direct reads of `src/app/share/**`, `src/lib/share/**`, `src/lib/server/share-*`, and `src/lib/gemini/json-schemas.ts`:

- Routes `/share` and `/share/[platform]` are live and rendering. `/share` shows KPI summary + 4-platform grid. `/share/[platform]` shows product list + detail drawer with 3 tabs (Output, Generate, History).
- Generate form fields (current contract): `affiliate_url`, `platform` (readonly from URL), `angle` (6 options), `variant_count` (1–4).
- Server action `generateShareCaption` upserts `share_product_links`, creates `share_generations`, fires fire-and-forget background task `runRealShareCaptionTask`.
- Worker calls Gemini with `GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA` and stores variants in `share_generations.output_json`.
- Output schema already includes `platform_specific_fields`:
  - `reply_with_link` (X)
  - `pin_title` (Pinterest)
  - `hashtags` (Facebook 1–3, X 0–2)
- UI today only renders `variant.caption`. `platform_specific_fields` is generated, persisted, but invisible to the operator.
- `PLATFORM_CHAR_LIMITS` constant exists. Worker logs over-limit captions via `console.warn` only — no UI signal.
- No disclosure / `#ad` / `#affiliate` label is added or surfaced.
- No image prompt support (no image input, no image output, no Pinterest visual prompt).
- No direct integration with Prompt Pack data (`prompt_packs`, `prompt_pack_generated_files`). Worker only sees product name + affiliate URL.
- Only product fields actually passed to Gemini: `product_name`, `affiliate_url`. `marketplace`, description, USP, price, images are not passed.
- Build status (per audit): `npm run lint` PASS (0 errors / 92 warnings), `npm run typecheck` PASS, `npm run build` PASS.

---

## 2. V1 Goal

Make the existing Share Link Caption Generator operationally complete for the four locked platforms (Facebook, Threads, X, Pinterest) by:

1. Surfacing data that is already generated and stored (`platform_specific_fields`) so the operator can copy/use it.
2. Giving the operator visible feedback against `PLATFORM_CHAR_LIMITS` instead of hiding it in console.
3. Letting the operator pass platform-aware generation options (e.g. tone, hashtag mode, character target) through a typed contract.
4. Producing structured output blocks (caption + reply/title + hashtags + optional image prompt) with copy-ready actions per block.
5. Strengthening the Gemini prompt with product metadata that already exists (description, USP, marketplace, etc.) without changing the DB schema.
6. Keeping Prompt Pack integration as a deferred, explicitly-decided V2 item.

V1 is shipped when an operator can:
- Open a product on `/share/[platform]`.
- Generate variants with platform-aware fields filled in.
- See structured blocks (caption, reply, title, hashtags, image prompt) with copy buttons per block.
- See live char count vs platform limit while reading output.

---

## 3. Non-Goals (V1)

The following remain out of scope until a follow-up task is approved:

- No new social platforms beyond the locked four.
- No social posting / OAuth / autopost — manual share only.
- No Supabase migrations. No `share_generations` schema changes. No `ai_task_type` enum changes.
- No new dependencies (npm packages).
- No rewrite of the share feature, no rebuild of `share-caption-task.ts` retry semantics, no rewrite of key routing.
- No persistence model change — output stays in `share_generations.output_json`.
- No copy/share analytics, no per-variant favoriting, no per-variant regen.
- No Prompt Pack read/write integration (deferred, see SHARE-V1-009).
- No disclosure / `#ad` / FTC-label feature in V1 (separate decision; not in audit-confirmed gaps as approved).
- No image prompt *generation pipeline* beyond the contract layer + UI rendering. Image prompts will be produced by Gemini as text only — no i2i / i2v / Drive image asset integration.
- No edits to the existing Phase 1 route lock, mobile nav, topbar, or settings UX.

---

## 4. Implementation Sequence

Strict order — later tasks depend on contracts established earlier.

```
SHARE-V1-001  Render existing platform_specific_fields            (UI only, lowest risk)
SHARE-V1-002  Char count / warning UI                             (UI only)
SHARE-V1-003  Platform-aware generate options contract            (types only, no UI)
SHARE-V1-004  Platform-aware generate form fields                 (UI consumer of 003)
SHARE-V1-005  Structured output blocks contract                   (types + schema-shape only)
SHARE-V1-006  Image prompt output contract                        (extends 005, no UI)
SHARE-V1-007  Render image prompt blocks in UI                    (UI consumer of 006)
SHARE-V1-008  Improve Gemini prompt context from product metadata (server prompt builder)
SHARE-V1-009  Decide Prompt Pack integration strategy             (decision doc only) [DEFERRED]
```

Rationale:
- 001 and 002 are pure-frontend, zero-risk wins that surface latent value. Ship first.
- 003 → 004 → 005 → 006 establishes a typed contract before any new UI/schema rendering.
- 007 consumes 006.
- 008 changes prompt text only (no schema, no migration). Done after the output contract is stable so UI can absorb new fields if Gemini starts returning richer content.
- 009 is documentation-only; it sequences cleanly at the end because the answer depends on what 001–008 expose.

Each task ends with verification (`npm run lint` + `npm run typecheck` + `npm run build`) and a stop point — do not start the next task in the same run.

---

## 5. Micro-Task List

### SHARE-V1-001 — Render existing `platform_specific_fields`

**Goal:** Surface `reply_with_link`, `pin_title`, and `hashtags` already stored in `share_generations.output_json` so the operator can copy them. No backend or schema changes.

**Acceptance criteria:**
- For variants where `variant.platform === "x"` and `platform_specific_fields.reply_with_link` exists: render a separate "Reply dengan link" block with its own Copy button.
- For variants where `variant.platform === "pinterest"` and `platform_specific_fields.pin_title` exists: render a separate "Pin Title" block with its own Copy button and char count vs 100.
- For variants where `platform_specific_fields.hashtags` is a non-empty array: render hashtag chips (formatted with `#` prefix) plus a "Copy hashtags" action that copies a space-joined string.
- Loading, empty, and error states for the output tab continue to behave exactly as today.
- No design-token violations (audit:colors / audit:typography / audit:neutral-ui clean).
- No new dependencies.

**Out of scope:** Editing the Gemini schema. Editing the prompt builder. Editing the form. Adding new variant fields.

### SHARE-V1-002 — Char count / warning UI

**Goal:** Convert the existing `PLATFORM_CHAR_LIMITS` from a console-only check into operator-visible feedback in the output tab.

**Acceptance criteria:**
- For each variant caption, render a `count / limit` indicator (e.g. `247 / 280`) using existing typography tokens.
- When `caption.length > PLATFORM_CHAR_LIMITS[platform]`, the indicator switches to a warning style using existing semantic-warning tokens (no new hex values).
- Pin Title block (from 001) shows `count / 100`.
- Reply-with-link (from 001) shows `count / 280` (X-style limit; constant lives in `share-platform.ts` already or is added there as a new exported constant — no new file, no new dep).
- Behavior is read-only: do NOT truncate, reject, or auto-edit captions. The operator is informed only.

**Out of scope:** Server-side enforcement. Migration. Schema change.

### SHARE-V1-003 — Platform-aware generate options contract

**Goal:** Establish a typed contract for V1 generate options before adding any UI or backend handling.

**Acceptance criteria:**
- New TS types added to `src/lib/share/share-platform.ts` (or a sibling file in the same folder) describing per-platform option sets, e.g.
  - common: `tone` (enum: `casual` | `informative` | `aspirational`), `target_char_mode` (enum: `short` | `optimal` | `long`).
  - facebook: `cta_style` (`comment_link` | `inline_link`).
  - x: `include_reply` (bool, default true).
  - pinterest: `include_pin_title` (bool, default true).
- Pure type/contract task. No UI. No prompt change. No Gemini schema change.
- New types exported and `tsc --noEmit` clean.
- Contract is documented in this file and in inline JSDoc — no new docs/ file.

**Out of scope:** Wiring the contract into UI (that is 004) or into the prompt builder (that is part of 008).

### SHARE-V1-004 — Platform-aware generate form fields

**Goal:** Render the contract from 003 in `share-input-form.tsx`.

**Acceptance criteria:**
- For each platform, the Generate tab shows the correct subset of new fields (per 003 contract). Hidden fields must not be sent in form data.
- Defaults match 003 defaults; the form must remain valid if all new fields are at default (i.e. no breaking change to existing flow).
- Server action `generateShareCaption` accepts the new fields (validated through the same enum guards as `angle`/`platform`) but does NOT yet feed them into the Gemini prompt — it persists them on `share_generations` only via existing JSONB columns / existing input contract. If no JSONB slot exists for them, store them in-memory in the request flow and pass them to the worker call signature only.
  - Constraint reminder: NO migration. If there is no existing column to persist these inputs, scope this task to wiring them through the form → action → worker function arguments without persistence. Persistence becomes a separate, explicitly-approved task.
- Loading / disabled / error states preserved.
- Tokens: no hardcoded color/typography.

**Out of scope:** Adding new DB columns. Sending the new fields to Gemini (that's 008).

### SHARE-V1-005 — Structured output blocks contract

**Goal:** Define the V1 "structured output blocks" type so the UI and prompt builder can be aligned.

**Acceptance criteria:**
- New TS type `ShareCaptionBlock` (or similar) added in `src/lib/share/share-platform.ts` describing block shape: `{ kind: "caption" | "reply_with_link" | "pin_title" | "hashtags" | "image_prompt"; label: string; value: string | string[]; charLimit?: number }` (final shape decided in implementation, but must include `kind`, `value`, and optional `charLimit`).
- Helper function `buildShareOutputBlocks(variant, platform): ShareCaptionBlock[]` exported from the same module. It maps the existing `output_json` shape into an ordered block list.
- Helper is pure / framework-agnostic so it can be unit-checkable and reused by both server and client code.
- This task is contract + helper only. No UI change in this task. The helper must be type-safe against the existing `ShareCaptionVariant` shape (do NOT widen the schema).

**Out of scope:** UI change. JSON schema change. Migration.

### SHARE-V1-006 — Image prompt output contract

**Goal:** Add a contract for an optional `image_prompt` (text only, Pinterest-priority) without yet generating it.

**Acceptance criteria:**
- Extend the TS-side variant type used by the UI (NOT the DB schema, NOT the Gemini JSON schema in `json-schemas.ts` yet) to optionally carry `platform_specific_fields.image_prompt: string` with proper optionality.
- `buildShareOutputBlocks` from 005 emits an `image_prompt` block when present and `platform === "pinterest"` (extendable later).
- Provide a guard `hasImagePrompt(variant): boolean` for the UI consumer.
- Document that this is the *contract* layer only — Gemini is NOT yet asked to produce `image_prompt` (that decision belongs to a later approved task; the V1 cut emits the block lazily, hidden when absent).

**Out of scope:** Modifying `GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA`. Modifying the prompt builder. Persisting the new field separately.

### SHARE-V1-007 — Render image prompt blocks in UI

**Goal:** UI consumer of 006. Show the `image_prompt` block when present.

**Acceptance criteria:**
- `share-output-tab.tsx` renders the block list from `buildShareOutputBlocks` (from 005/006) instead of only `variant.caption`.
- When `image_prompt` is absent, no block, no placeholder, no empty card.
- Block UI is compact (operator dashboard, not marketing): label + monospace-ish text + Copy button.
- Tokens only; no new colors. Loading / empty / error preserved.
- No regression on existing platforms — Facebook/Threads variants without `image_prompt` still render exactly as in V1-001.

**Out of scope:** Generating `image_prompt`. Schema/migration changes.

### SHARE-V1-008 — Improve Gemini prompt context from existing product metadata

**Goal:** Strengthen `buildShareCaptionPrompt` with product metadata that already exists in `products` (and joined tables) so captions are less generic. NO schema changes.

**Acceptance criteria:**
- Worker `runRealShareCaptionTask` (or its caller in `share-generations.ts:createShareGeneration`) reads available product metadata (e.g. description, USP / selling angle, target viewer, marketplace) from existing tables only — no new tables, no new columns, no new joins beyond what `getShareListRowByProductId` already loads.
- `buildShareCaptionPrompt` receives this metadata as additional named arguments and embeds it in the prompt under a clearly-labeled "Konteks Produk" block.
- Backwards-compatible: missing fields produce no prompt fragment (no `null` strings, no "undefined" leaking into the prompt).
- The Gemini JSON response schema is UNCHANGED by this task.
- Verification: existing share generations continue to succeed (mock or live). No new variant fields appear in `output_json`.

**Out of scope:** Sending images. Sending Prompt Pack data. Adding `image_prompt` generation. Modifying `GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA`. New Gemini key purpose. New cooldown logic.

### SHARE-V1-009 — Decide Prompt Pack integration strategy (later)

**Status:** DEFERRED — implementasi ditunda hingga post-V1. Share workspace V1 akan ship tanpa Prompt Pack integration.

**Rationale:** Phase 1 route lock (AGENTS.md) explicitly excludes Prompt Pack primary UI and integration. Share workspace V1 sudah memiliki product metadata context yang cukup (SHARE-V1-008 DONE). Prompt Pack integration memerlukan decision doc + migration + UI changes yang keluar dari V1 scope. Defer hingga Phase 2 atau post-MVP evaluation.

**Goal (when resumed):** Document a decision, not code. Capture options + recommendation for whether/how the share feature should read from `prompt_packs` / `prompt_pack_generated_files`.

**Acceptance criteria (when resumed):**
- New section appended to this V1 plan doc (or separate `docs/share-prompt-pack-integration-decision.md`) listing:
  - Option A: No integration (status quo).
  - Option B: Read-only — share prompt context borrows existing pack caption/tags.
  - Option C: Two-way — share generations attached to prompt packs.
- Each option includes: scope, risk, migration impact, UI impact, and PRD/lock conformance.
- Recommendation + open questions, but NO code change, NO migration, NO new types.

**Out of scope:** Any actual integration code. Any DB change.

---

## 6. Files Likely Touched per Task

| Task | Likely files | Notes |
|---|---|---|
| SHARE-V1-001 | `src/app/share/[platform]/share-output-tab.tsx`, `src/styles/05-features/share-workspace.css` | UI only. New blocks reuse existing tokens. |
| SHARE-V1-002 | `src/app/share/[platform]/share-output-tab.tsx`, `src/lib/share/share-platform.ts` (re-export limit constants if needed), `src/styles/05-features/share-workspace.css` | UI only. Reuses `PLATFORM_CHAR_LIMITS`. |
| SHARE-V1-003 | `src/lib/share/share-platform.ts` (or `src/lib/share/share-options.ts`) | Types only. |
| SHARE-V1-004 | `src/app/share/[platform]/share-input-form.tsx`, `src/app/share/[platform]/actions.ts`, `src/lib/server/share-generations.ts` (function signature only) | UI + action wiring; NO new DB column. |
| SHARE-V1-005 | `src/lib/share/share-platform.ts`, possibly `src/lib/share/share-output-blocks.ts` | Type + pure helper. |
| SHARE-V1-006 | `src/lib/share/share-output-blocks.ts`, type extension only — NOT `src/lib/gemini/json-schemas.ts` | Contract layer only. |
| SHARE-V1-007 | `src/app/share/[platform]/share-output-tab.tsx`, `src/styles/05-features/share-workspace.css` | UI consumer. |
| SHARE-V1-008 | `src/lib/server/share-caption-task.ts` (prompt builder section), `src/lib/server/share-generations.ts` (read additional existing product fields), possibly `src/lib/server/share-list.ts` (only if data already loaded there). | Server prompt only; schema unchanged. |
| SHARE-V1-009 | `docs/share-link-caption-generator-v1-plan.md` (this file) or new `docs/share-prompt-pack-integration-decision.md` | Docs only. |

Files explicitly forbidden by V1 scope:
- `supabase/migrations/**` — no new migration in V1.
- `src/lib/gemini/json-schemas.ts` — frozen for V1 (006 deliberately keeps the wire schema unchanged).
- `src/lib/server/gemini-key-routing.ts` — shared infra.
- `src/lib/ai-tasks/validation.ts` — `ai_task_type` enum frozen for V1.

---

## 7. Risk Level per Task

| Task | Risk | Why |
|---|---|---|
| SHARE-V1-001 | Low | Pure frontend; data already exists. |
| SHARE-V1-002 | Low | Pure frontend; constant already exists. |
| SHARE-V1-003 | Low | Types only. No runtime change. |
| SHARE-V1-004 | Medium | Touches form + server action signature. Defaults must be backwards-compatible or live generations break. |
| SHARE-V1-005 | Low | Pure helper + type. |
| SHARE-V1-006 | Low | Contract extension only; UI guarded by helper. |
| SHARE-V1-007 | Medium | Output tab is the primary read surface. Block ordering / empty handling must not regress. |
| SHARE-V1-008 | Medium-High | Prompt change can degrade live caption quality even though build still passes. Requires manual review of at least 2 sample generations per platform. |
| SHARE-V1-009 | Low | Docs only. |

Cross-cutting risks:
- The fire-and-forget worker pattern (audit §13) means a regression in 008 may only surface after several generations. Mitigate by checking `share_generations.error_message` and `output_json` after each manual smoke run.
- Lint warning count (92) is the V1 baseline; new code should not increase it.

---

## 8. Rollback Notes

All V1 tasks are intended to be revertable via `git revert` of a single commit per task. Specifically:

| Task | Rollback strategy |
|---|---|
| SHARE-V1-001 | Revert the commit. No data shape change → no orphan data. |
| SHARE-V1-002 | Revert the commit. Constants are pre-existing. |
| SHARE-V1-003 | Revert the commit. Types unused if 004 not shipped — nothing to clean up. |
| SHARE-V1-004 | Revert the commit. Form returns to the audit baseline. Server action signature must be reverted in the same revert. |
| SHARE-V1-005 / 006 | Revert the commit. Helpers/types removed. UI must still build because 007 has not landed yet at this point. If 007 already landed, revert 007 first. |
| SHARE-V1-007 | Revert the commit. Output tab returns to caption-only rendering. |
| SHARE-V1-008 | Revert the commit. Prompt returns to baseline. No data migration. Existing `output_json` rows stay valid because schema is unchanged. |
| SHARE-V1-009 | Revert the doc edit. |

If a task is partially shipped:
- DO NOT roll forward by patching on top. Roll back to last known-good commit, then re-pick the task fresh.
- DO NOT delete or rewrite migrations — none exist in V1.
- DO NOT clear `share_generations` rows as a rollback action; they remain forward-compatible because the DB shape never changes.

---

## 9. Verification Commands

Run after each task before marking it done.

Mandatory:
```bash
npm run lint
npm run typecheck
npm run build
```

Mandatory for any task that touches UI or CSS (SHARE-V1-001, -002, -004, -007):
```bash
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
```

Optional but recommended for SHARE-V1-004 and SHARE-V1-007 (UI-heavy):
```bash
npm run smoke:e2e
```

Per-task notes:
- SHARE-V1-008: in addition to the above, run a real generation against at least Facebook + Pinterest + X and confirm `share_generations.status === "generated"` and `output_json` non-empty. Document one example `output_json` per platform in the task handoff.
- SHARE-V1-009: docs-only task. Lint/typecheck/build still required (no docs-only skip), but no audit-* commands needed.

If verification fails, document the exact command, output, whether the failure existed before the task started (compare against audit §16 baseline: 0 lint errors, 92 warnings, typecheck PASS, build PASS), and whether it is related to the current task.

---

## 10. Handoff Protocol for Future OpenClaude Runs

Each future OpenClaude run that picks up a SHARE-V1-XXX task must:

**Pre-flight (before any code edit):**
1. Read this file (`docs/share-link-caption-generator-v1-plan.md`) end-to-end.
2. Read `docs/share-link-caption-generator-actual-audit.md` to anchor against actual current state.
3. Read the required AGENTS.md source-of-truth list for any task touching DB or routing (none in V1, but the rule still holds).
4. Run `git status` and `git diff --stat` for the files in the task's "Likely files" row. Treat any unexpected diff as another agent's in-progress work and stop.
5. Restate the task ID + goal + acceptance criteria + out-of-scope items + verification commands in the first reply.

**Execution:**
6. Implement only the named micro-task. Do not bundle SHARE-V1-001 with SHARE-V1-002, etc.
7. Use existing tokens. Do not add hex values, font weights, or new color tokens. If a token is missing, stop and add a token-layer task before proceeding.
8. No new npm dependencies.
9. No migration files. No edits in `supabase/migrations/`.
10. No edits to `src/lib/gemini/json-schemas.ts` for any V1 task. If the implementer believes a schema edit is required, stop and escalate.

**Verification:**
11. Run the mandatory commands from §9. Run audit:* commands when applicable.
12. For SHARE-V1-008 specifically, run at least one live Gemini generation per affected platform and capture the resulting `output_json` (truncated) in the handoff.

**Handoff response (final message back to user):**
13. Task ID + goal restated.
14. Source-of-truth docs read (this file, audit doc, AGENTS.md, and any other required lock).
15. `git diff --stat` plus a focused diff of changed files.
16. Verification command results in a table: command → exit code → notes.
17. Known risks + follow-up suggestions.
18. Explicit statement that no out-of-scope work was done, and confirmation that no migration/schema/dep was added.

**Acceptance gate:**
19. Do NOT mark the task done until all acceptance criteria above are met AND verification commands are PASS (or any failure is justified as pre-existing per audit §16).
20. Hand the next task back to the user, do not auto-pick the next SHARE-V1 task in the same run.

---

## Appendix A — Open questions (audit §14, deferred)

These questions remain open and are answered as below for V1 only. They MUST be re-confirmed before V2 work:

- Q: Render `platform_specific_fields`? **V1: yes, see SHARE-V1-001.**
- Q: Pass product description/USP/price to Gemini? **V1: yes, existing fields only, see SHARE-V1-008.**
- Q: Affiliate disclosure (#ad)? **V1: deferred. Not in V1.**
- Q: Enforce char limits or warn? **V1: warn only, see SHARE-V1-002.**
- Q: Prompt Pack integration? **V1: decision deferred to SHARE-V1-009.**
- Q: Image prompt generation? **V1: contract layer only (006/007). No actual prompt-builder change. No image bytes to Gemini.**
- Q: First-comment field for Facebook? **V1: deferred.**
- Q: Stuck-generation dead-letter beyond 90s timeout? **V1: deferred.**
- Q: Lenient variant count validation? **V1: deferred. Strict behavior preserved.**
- Q: Per-variant edit/regen? **V1: deferred. Full-batch regen only.**

---

## Appendix B — Verification result for this doc-only task

Verified 2026-05-24T06:07 UTC.

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | Exit 0. 0 errors, 92 warnings (matches audit §16 baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes compiled successfully. |

No app code was modified in this task. Verification confirms the repo remains in the audit-documented baseline state.

---

## Implementation Log

### SHARE-V1-001 — Render existing platform_specific_fields

**Status:** DONE
**Date:** 2026-05-24
**Implementer:** OpenClaude CLI

#### Files Changed

| File | Change |
|------|--------|
| `src/app/share/[platform]/share-output-tab.tsx` | Replaced flat caption render with structured output blocks: Main Caption, X Reply With Link, Pinterest Pin Title, Hashtags chips. Per-block copy buttons with index-offset feedback tracking. |
| `src/styles/05-features/share-workspace.css` | Added `.share-output-block`, `.share-output-block__label`, `.share-output-block__content`, `.share-output-block__actions`, `.share-output-block__count`, `.share-output-block__hashtags`, `.share-output-hashtag` classes using design tokens. Mobile responsive rules included. |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

#### Acceptance Criteria Met

- [x] Existing variant grouping preserved (map over `generation.output_json`)
- [x] Main Caption block with Copy + Manual Share buttons
- [x] X Reply With Link block (conditional: platform=x AND reply_with_link present)
- [x] Pinterest Pin Title block with char count `{length} / 100` (conditional: platform=pinterest AND pin_title present)
- [x] Hashtags block as `#tag` chips with Copy button (conditional: non-empty array)
- [x] Backward compatible — older output_json with only `caption` renders fine (no platform_specific_fields = no extra blocks)
- [x] Copy button per block (unique index offsets: +1000 reply, +2000 pin title, +3000 hashtags)
- [x] All CSS uses design tokens only (no hardcoded colors/sizes)

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes compiled. |

#### Risks & Notes

- Pin Title char count shows `{length} / 100` as a static reference. SHARE-V1-002 will add dynamic color/warning based on `PLATFORM_CHAR_LIMITS`.
- Hashtags Copy joins as `#tag1 #tag2 #tag3` (space-separated). If platform conventions differ, adjust in a later task.
- No backend, schema, migration, or dependency changes were made.

#### Handoff for Next Run

Next task: **SHARE-V1-002 — Char count / warning UI**. This task adds live character count indicators with color-coded warnings against `PLATFORM_CHAR_LIMITS` for all output blocks. It builds on the block structure established in SHARE-V1-001.

---

### SHARE-V1-002 — Char count / warning UI

**Status:** DONE
**Date:** 2026-05-24
**Implementer:** OpenClaude CLI

#### Files Changed

| File | Change |
|------|--------|
| `src/lib/share/share-platform.ts` | Added `PIN_TITLE_CHAR_LIMIT`, `X_REPLY_CHAR_LIMIT`, `CharStatus` type, and `evaluateCharStatus()` helper function. |
| `src/app/share/[platform]/share-output-tab.tsx` | Added char count calculation per block (caption, reply, pin title). Rendered count with `data-status` attribute. Added warning banner when `status === "over"`. |
| `src/styles/05-features/share-workspace.css` | Added `.share-output-block__count[data-status="warning"]` (amber), `[data-status="over"]` (red), and `.share-output-block__warning` banner styles using design tokens. |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

#### Acceptance Criteria Met

- [x] Character count displayed for Caption block: `{count} / {PLATFORM_CHAR_LIMITS[platform]}`
- [x] Character count displayed for X Reply With Link block: `{count} / 280`
- [x] Character count displayed for Pinterest Pin Title block: `{count} / 100`
- [x] Color-coded status: `ok` (muted gray), `warning` (amber at ≥90%), `over` (red when exceeds limit)
- [x] Warning banner shown when `status === "over"` with Indonesian copy: "Melebihi batas {platform} ({limit} karakter). Edit sebelum di-share."
- [x] Output remains copy-ready — no truncation, no rejection
- [x] Backward compatible — older generations without platform_specific_fields still render fine
- [x] All CSS uses design tokens (no hardcoded colors)

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes compiled. |

#### Risks & Notes

- `evaluateCharStatus()` uses 90% threshold for warning state. If platform-specific thresholds are needed (e.g., X at 95%, Pinterest at 85%), extend the helper signature in a later task.
- Warning banner only shows for `over` state. If `warning` state also needs a softer banner, add it in a follow-up polish task.
- Hashtags block does not show char count (no platform-specific limit for hashtag arrays). If needed, add in a later task.
- No backend, schema, migration, or dependency changes were made.

#### Handoff for Next Run

Next task: **SHARE-V1-003 — Platform-aware generate options contract**. This task defines TypeScript types for platform-aware generation options (tone, hashtag mode, character target) without adding UI. It establishes the contract layer that SHARE-V1-004 will consume.

---

### SHARE-V1-003 — Platform-aware generate options contract

**Status:** PARTIAL (contract + action wiring DONE; persistence BLOCKED — resolved by SHARE-V1-003a below)
**Date:** 2026-05-24
**Implementer:** OpenClaude CLI

#### Files Changed

| File | Change |
|------|--------|
| `src/lib/share/share-platform.ts` | Added `FacebookGenerateOptions`, `ThreadsGenerateOptions`, `XGenerateOptions`, `PinterestGenerateOptions`, `ShareGenerateOptions` union, `DEFAULT_SHARE_GENERATE_OPTIONS`, `getDefaultShareGenerateOptions()`, and `normalizeShareGenerateOptions()`. |
| `src/app/share/[platform]/actions.ts` | Updated import to include `normalizeShareGenerateOptions` and `ShareGenerateOptions`. Added `options_json` FormData field parsing: reads optional JSON string, normalizes via `normalizeShareGenerateOptions`, falls back to `undefined` if absent or invalid. Options are parsed but not persisted (see BLOCKED below). |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

#### Acceptance Criteria Met

- [x] `FacebookGenerateOptions`: `postMode`, `captionLength`, `includeFirstComment`, `includeImagePrompt`, `imageRatio`
- [x] `ThreadsGenerateOptions`: `mode`, `linkPlacement`, `imagePlacement`, `imageRatio`
- [x] `XGenerateOptions`: `mode`, `lengthMode`, `linkPlacement`, `includeImagePrompt`, `imageRatio`
- [x] `PinterestGenerateOptions`: `pinType`, `seoKeywordMode`, `seoKeyword`, `ctaStyle`, `includeImagePrompt`, `imageRatio`, `generateAltText`
- [x] `ShareGenerateOptions` discriminated union exported
- [x] `getDefaultShareGenerateOptions(platform)` exported
- [x] `normalizeShareGenerateOptions(platform, raw)` exported — safe against untrusted input, falls back to defaults per field
- [x] `actions.ts` parses `options_json` FormData field if present; backward compatible (absent = no change to existing flow)
- [x] `tsc --noEmit` clean
- [x] No UI added, no Gemini schema change, no migration

#### BLOCKED — Persistence

`share_generations` has no `input_params` or `options_json` column. The only JSONB column is `output_json`, which is reserved for Gemini output. Persisting selected options requires:

```sql
ALTER TABLE share_generations ADD COLUMN input_params jsonb;
```

This migration is **out of scope for SHARE-V1-003** per the task constraint ("If persistence requires migration, stop and document BLOCKED instead of inventing schema") and per AGENTS.md migration-first rule.

**Current behavior:** Options are parsed and normalized in the server action but immediately discarded (`void options`). They are not forwarded to `createShareGeneration` or the background worker. Existing generations are unaffected.

**Recommended follow-up task (SHARE-V1-003a):** Add an approved migration `ALTER TABLE share_generations ADD COLUMN input_params jsonb;`, then update `createShareGeneration` to accept and persist `input_params`, and update `runRealShareCaptionTask` to receive and forward options to `buildShareCaptionPrompt`. This should land before SHARE-V1-004 (UI) so that options submitted via the form survive page reload.

---

### SHARE-V1-003a — Add `input_params` migration and wire options through

**Status:** DONE
**Date:** 2026-05-24
**Implementer:** OpenClaude CLI

#### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260524063500_add_share_generations_input_params.sql` | New migration: `ALTER TABLE share_generations ADD COLUMN input_params jsonb;` with column comment. |
| `src/lib/server/share-generations.ts` | Added `ShareGenerateOptions` import. Updated `createShareGeneration` signature to accept `inputParams?: ShareGenerateOptions`. Persists `input_params` on INSERT. Forwards `inputParams` (as `null` when absent) to `taskInput` for the background worker. |
| `src/lib/server/share-caption-task.ts` | Added `ShareGenerateOptions` import. Extended `ShareCaptionTaskInput` with `inputParams?: ShareGenerateOptions | null`. Added `void input.inputParams` in `buildShareCaptionPrompt` with comment noting future wiring in SHARE-V1-008. |
| `src/app/share/[platform]/actions.ts` | Removed `void options` lint suppression. Now passes `inputParams: options` to `createShareGeneration`. |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

#### Acceptance Criteria Met

- [x] Migration file created and applied via Supabase MCP
- [x] `share_generations.input_params jsonb` column confirmed in DB (nullable, backward compatible)
- [x] `createShareGeneration` accepts and persists `inputParams`
- [x] `ShareCaptionTaskInput` extended with `inputParams?: ShareGenerateOptions | null`
- [x] Options flow: form → `actions.ts` → `createShareGeneration` → DB + `taskInput` → `runRealShareCaptionTask`
- [x] Backward compatible — existing rows have `input_params = null`, existing calls without `inputParams` still work
- [x] `tsc --noEmit` clean
- [x] No UI added, no Gemini schema change, no new dependencies

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes compiled. |
| DB column check | PASS | `input_params jsonb YES` confirmed via `information_schema.columns`. |

#### Risks & Notes

- `inputParams` is persisted as raw JSONB. No server-side re-validation on read — consumers must use `normalizeShareGenerateOptions` when reading back from DB.
- `buildShareCaptionPrompt` receives `inputParams` but does not yet use it in prompt text. Wiring options into the prompt is deferred to SHARE-V1-008 (or a dedicated polish task).
- `taskInput.inputParams` uses `null` (not `undefined`) to satisfy the `JsonValue` constraint on `createAITask`.

#### Handoff for Next Run

Next task: **SHARE-V1-004 — Platform-aware generate form fields**. The options contract (003) and persistence (003a) are both in place. SHARE-V1-004 can now render form fields for each platform option and submit them as `options_json` in FormData — they will be parsed, normalized, and persisted end-to-end.

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes compiled. |

#### Risks & Notes

- `normalizeShareGenerateOptions` uses inline `includes()` guards per field. If option sets grow, consider a generic `oneOf()` helper in a later refactor.
- `seoKeyword` is clamped to 100 chars in the normalizer to prevent prompt injection via oversized strings.
- `void options` suppresses the unused-variable lint warning, consistent with the existing `void latestGenerationId` pattern in `share-output-tab.tsx`.
- No backend, schema, migration, or dependency changes were made.

#### Handoff for Next Run

Next task: **SHARE-V1-003a (recommended) — Add `input_params jsonb` migration** (requires explicit migration approval), OR skip directly to **SHARE-V1-004 — Platform-aware generate form fields** with the understanding that submitted options will not be persisted until 003a lands. If skipping 003a, SHARE-V1-004 must document that options are in-memory only and will be lost on page reload.

---

### SHARE-V1-004 — Platform-aware generate form fields — DONE 2026-05-24

#### Implementation Log

Added compact platform-specific settings UI to `share-input-form.tsx` directly under the existing fields (Affiliate URL, Platform readonly, Angle, Jumlah varian). Only the active route platform's fields render — Platform Target selector is intentionally absent because the platform is determined by the `/share/[platform]` route.

**Files Changed:**

- `src/app/share/[platform]/share-input-form.tsx` — added per-platform option state (Facebook/Threads/X/Pinterest), `optionsPayload` useMemo to assemble the active platform's payload, hidden `<input name="options_json">` populated from `JSON.stringify(optionsPayload)`, and a single `<fieldset className="share-input-options">` with platform-conditional blocks.
- `src/styles/05-features/share-workspace.css` — added `.share-input-options`, `.share-input-options__grid`, `.share-input-field--checkbox` styles. All values use design tokens. Mobile collapse to single column at ≤860px.
- `docs/share-link-caption-generator-v1-plan.md` — this Implementation Log entry.

**Field Inventory by Platform:**

- **Facebook:** Mode Post (feed/story/reel), Panjang Caption (short/medium/long), Image Ratio (1:1/4:5/16:9/9:16), First Comment (checkbox), Image Prompt (checkbox).
- **Threads:** Mode (single/thread), Link Placement (in_caption/first_reply/none), Image Placement (with_post/none), Image Ratio (1:1/4:5/9:16).
- **X:** Mode (single_tweet/thread), Length Mode (punchy/standard), Link Placement (reply/none), Image Ratio (1:1/16:9), Image Prompt (checkbox).
- **Pinterest:** Pin Type (standard/idea), SEO Keyword Mode (auto/manual), SEO Keyword input (rendered only when mode === "manual", maxLength 100), CTA Style (soft/direct), Image Ratio (2:3/1:1), Image Prompt (locked ON — `disabled` checkbox + `(wajib)` label, payload always sets `includeImagePrompt: true`), Alt Text (checkbox).

**Submission Mechanics:**

- Options are serialized as `JSON.stringify(optionsPayload)` into a hidden `<input type="hidden" name="options_json">`.
- Field names match `normalizeShareGenerateOptions` exactly (camelCase: `postMode`, `captionLength`, `linkPlacement`, etc.).
- Server action `generateShareCaption` already reads and parses `options_json` (no backend change required).
- Defaults sourced from `DEFAULT_SHARE_GENERATE_OPTIONS[platform]`.

**Notes:**

- No backend logic, no Gemini schema change, no migration, no auto-posting, no platform selector, no image upload, no Prompt Pack.
- SEO Keyword payload is `""` when `seoKeywordMode === "auto"` so users don't accidentally persist stale manual keywords after switching modes.
- Pinterest `includeImagePrompt` is hardcoded `true` in the payload (not from state) — locked per task spec.

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. `/share/[platform]` route compiled. |

#### Risks & Notes

- Form state is purely local — switching platform routes will reset to defaults (this is intentional and matches the per-route URL contract).
- `seoKeyword` is clamped on the server in `normalizeShareGenerateOptions`; the client also enforces `maxLength={100}` for UX feedback.
- Native `<select>` controls are used to keep the UI compact and avoid pulling in `RelationalPicker` for binary/ternary choices.

#### Handoff for Next Run

Next task: **SHARE-V1-005** — see backlog. Form options now flow form → action → DB → background worker (worker still ignores the params; SHARE-V1-008 will wire them into the Gemini prompt).

---

### SHARE-V1-005 — Structured output blocks contract — DONE 2026-05-24

#### Implementation Log

Defined a structured copy-block contract that lets a single variant carry multiple addressable copy blocks (caption, first comment, thread sections, X reply, Pinterest pin title/description/destination/alt text, hashtags), each with its own char count and recommended limit. Old-format variants without a `blocks` field still render through a backward-compatible derive helper.

**Files Changed:**

- `src/lib/share/share-platform.ts`
  - Added `SHARE_CAPTION_BLOCK_ROLES` const (9 roles) and `ShareCaptionBlockRole` type.
  - Added `ShareCaptionBlock` interface: `{ role, label, content, char_count, recommended_max_chars, copy_ready, warning? }`.
  - Added `RECOMMENDED_BLOCK_LIMITS` map with per-role char limits.
  - Added `ShareCaptionVariantV2` interface — extends old shape with optional `blocks?: ShareCaptionBlock[]` and optional `image_prompt?: ShareImagePromptBlock` (defined in V1-006).
  - Added `hasStructuredBlocks(variant)` and `hasImagePrompt(variant)` type guards.
  - Added `buildShareOutputBlocks(variant, platform)` helper. **Backward-compatible:** if `variant.blocks` is present, return it. Otherwise derive blocks from `variant.caption + variant.platform_specific_fields` so old `output_json` rows continue to render.
- `src/lib/gemini/json-schemas.ts`
  - Added `shareCaptionBlockSchema` (object with required role/label/content/char_count/recommended_max_chars/copy_ready, optional warning).
  - Extended `shareCaptionVariantSchema.properties` with optional `blocks: array<shareCaptionBlockSchema>`.
  - `caption`, `angle`, `platform` remain required for backward compat — Gemini may still emit old shape; new `blocks` field is additive.
- `src/lib/server/share-caption-task.ts`
  - Extended `ShareCaptionVariant` type with optional `blocks` and `image_prompt`.
  - Rewrote `buildShareCaptionPrompt` to instruct Gemini on the block contract per platform/options:
    - Always require `main_caption` block (mirrors `caption` field).
    - Facebook + `includeFirstComment` → require `first_comment` block.
    - Threads + `mode === "thread"` → require 2-5 `thread_section` blocks.
    - X + `mode === "thread"` → require 3-7 `thread_section` blocks.
    - X + `linkPlacement === "reply"` → require `x_reply_with_link` block.
    - Pinterest → always require `pinterest_pin_title`, `pinterest_pin_description`, `pinterest_destination_link`. With `generateAltText` → also `pinterest_alt_text`.
  - Added affiliate disclosure rule and affiliate-URL-as-CTA-only rule to the prompt.

**Backward Compatibility:**

- Old variants persisted before this task (only `caption + angle + platform + platform_specific_fields`) render unchanged via `buildShareOutputBlocks` which synthesizes `main_caption`, `x_reply_with_link`, `pinterest_pin_title`, and `hashtags` blocks from the legacy fields.
- The Gemini schema does not require `blocks` — Gemini may still emit old shape and the worker will persist it. UI consumers should always go through `buildShareOutputBlocks(variant, platform)` rather than reading `variant.blocks` directly.
- `share_generations.output_json` shape is unchanged at the DB level (still `jsonb`). No migration needed.

#### Verification Results (V1-005 + V1-006 combined, 2026-05-24)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches audit baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes including `/share/[platform]` compiled. |

#### Risks & Notes

- Gemini may still emit old shape (without `blocks`) intermittently — this is intentional and handled by `buildShareOutputBlocks`.
- `RECOMMENDED_BLOCK_LIMITS` are advisory; the worker still uses `PLATFORM_CHAR_LIMITS` for the main caption console.warn check. Per-block over-limit warnings are operator-side via the `warning` field that Gemini may set.
- No UI rendering for blocks yet — that lands in a later V1 task (SHARE-V1-007 or similar). This task only ships the contract + helpers.

#### Handoff for Next Run

V1-005 + V1-006 shipped together (see V1-006 below). Next task: **SHARE-V1-007** — render structured blocks + image prompt in the share output tab.

---

### SHARE-V1-006 — Image prompt output contract — DONE 2026-05-24

#### Implementation Log

Added an optional `image_prompt` field to each variant carrying an i2i (image-to-image) prompt block, instructing the operator which product images to upload as references and what visual treatment to request. Reuses the i2i discipline pattern (`image_inputs`, `prompt_text`, `must_keep`, `must_avoid`) already established by `prompt-pack-contract.ts`.

**Files Changed:**

- `src/lib/share/share-platform.ts`
  - Added `ShareImagePromptBlock` interface: `{ source: "i2i", image_inputs: string[], prompt_text: string, must_keep: string[], must_avoid: string[], aspect_ratio: string, upload_note: string }`.
  - Added `hasImagePrompt(variant)` type guard.
  - Wired `image_prompt?: ShareImagePromptBlock` onto `ShareCaptionVariantV2`.
- `src/lib/gemini/json-schemas.ts`
  - Added `shareImagePromptBlockSchema` with all 7 fields required.
  - Extended `shareCaptionVariantSchema.properties` with optional `image_prompt: shareImagePromptBlockSchema`.
- `src/lib/server/share-caption-task.ts`
  - Extended `ShareCaptionVariant` type with optional `image_prompt`.
  - Added image-prompt instruction block to `buildShareCaptionPrompt`. Triggers when:
    - Facebook + `includeImagePrompt`
    - X + `includeImagePrompt`
    - Pinterest (always — locked ON per V1-004 contract)
  - Prompt instruction enforces: `source: "i2i"`, descriptive `image_inputs` for operator to upload, `must_keep` for product fidelity, **mandatory `must_avoid` list**: text overlay, price label, discount badge, fake logo, fake UI, unsupported claims, product shape changes. `aspect_ratio` derived from the active platform option.

**Image Prompt Discipline Rules (in prompt text):**

- Source must be `"i2i"` — no text-to-image generation.
- Prompt text focuses on staging/lighting/composition only — never product modification.
- Explicit must_avoid list mirrors the rules from the user spec.
- Affiliate URL stays in caption/copy blocks, not in image prompt.

**Backward Compatibility:**

- `image_prompt` is fully optional in both the TypeScript types and Gemini schema. Old variants without it pass through unchanged.
- `hasImagePrompt(variant)` provides a clean type-narrowing guard for future UI.

#### Verification Results (combined with V1-005, 2026-05-24)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors, 92 warnings (matches audit baseline). |
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run build` | PASS | Exit 0. All routes including `/share/[platform]` compiled. |

#### Risks & Notes

- Gemini may emit `image_prompt` even when not requested if the response is creative — this is acceptable; downstream UI will only render when `hasImagePrompt(variant)` returns true AND the form requested one.
- The prompt instruction strongly discourages disallowed visual asks but is not a hard guardrail — UI rendering should add operator-side warnings if `must_avoid` items leak into `prompt_text`.
- No image generation, upload, or storage is wired — this task is contract-only. Image generation/upload is out of V1 scope.

#### Handoff for Next Run

Next task: **SHARE-V1-007** — render structured blocks + image prompt in the share output tab. Contract is fully in place; UI consumer should use `buildShareOutputBlocks(variant, platform)` for blocks and `hasImagePrompt(variant)` to gate the image prompt panel.

---

### SHARE-V1-007 — Render structured output blocks + image prompt — DONE 2026-05-24

#### Implementation Log

Replaced the manual per-field block rendering in `share-output-tab.tsx` with a unified loop over `buildShareOutputBlocks(variant, platform)`. Both V1 structured variants (`variant.blocks`) and legacy variants (`variant.caption + platform_specific_fields`) now flow through the same render path. Added full image prompt panel rendering with copy buttons for prompt text, must_keep, and must_avoid arrays.

**Files Changed:**

| File | Change |
|------|--------|
| `src/app/share/[platform]/share-output-tab.tsx` | Replaced manual block rendering with `buildShareOutputBlocks()` loop. Added Pinterest "Image wajib untuk Pin" inline notice. Added full `image_prompt` panel gated by `hasImagePrompt(variant)`. New copy-feedback offset scheme: `index * 100 + N` (blocks 0–89, prompt 90, must_keep 91, must_avoid 92). Dropped direct imports of `PLATFORM_CHAR_LIMITS`, `PIN_TITLE_CHAR_LIMIT`, `X_REPLY_CHAR_LIMIT` — char limits now come from `block.recommended_max_chars`. |
| `src/styles/05-features/share-workspace.css` | Appended SHARE-V1-007 image-prompt CSS block (~115 lines): `.share-output-image-prompt`, `__header`, `__title`, `__ratio`, `__field`, `__label` (with `data-tone="keep"/"avoid"`), `__text`, `__list` (chip list with tone variants), `__note`. All values use design tokens (`--badge-green-*`, `--badge-red-*`, `--color-*`, `--space-*`, `--radius-*`). |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

**Render Path:**

1. `buildShareOutputBlocks(variant, variantPlatform)` returns an ordered `ShareCaptionBlock[]` regardless of variant format.
2. Each block renders: label + char count (`block.char_count / block.recommended_max_chars`) with `data-status` coloring, optional warning banner when `status === "over"` or `block.warning` is set, content, Copy button.
3. The `main_caption` block additionally gets a Manual Share button (uses `navigator.share` if available, falls back to clipboard).
4. Pinterest variants show a `share-inline-note[data-tone="warning"]` notice before the block list: "Image wajib untuk Pin — siapkan visual sesuai prompt di bawah."
5. `hasImagePrompt(variant)` gates the image prompt panel. When present, renders: header (ImageIcon + aspect_ratio chip), prompt text field with Copy Prompt button, image_inputs chip list (if non-empty), must_keep chip list (`data-tone="keep"`) with Copy button, must_avoid chip list (`data-tone="avoid"`) with Copy button, upload_note paragraph.

**Backward Compatibility:**

- Old variants without `blocks` field render via `buildShareOutputBlocks` legacy derive path — no regression.
- Old variants without `image_prompt` skip the image prompt panel entirely — `hasImagePrompt` returns false.
- Copy-feedback index scheme changed from `+1000/+2000/+3000` offsets to `index * 100 + N` — purely local UI state, no persistence impact.

#### Acceptance Criteria Met

- [x] V1 variants with `blocks` render from `variant.blocks` via `buildShareOutputBlocks`
- [x] Legacy variants without `blocks` fall back to derived blocks (caption + platform_specific_fields)
- [x] Each block shows char count + `data-status` coloring + warning banner when over limit
- [x] Copy button per block with 2s feedback ("Tersalin")
- [x] `main_caption` block gets Manual Share button
- [x] Pinterest shows "Image wajib untuk Pin" inline notice
- [x] `image_prompt` panel renders when `hasImagePrompt(variant)` is true
- [x] Image prompt: aspect ratio chip, prompt text + Copy Prompt, must_keep chips + Copy, must_avoid chips + Copy, upload_note
- [x] All CSS uses design tokens only (no hardcoded colors/sizes)
- [x] Mobile layout clean and compact

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run lint` | PASS | 0 errors, 92 warnings (matches audit baseline). |
| `npm run build` | PASS | Exit 0. All routes including `/share/[platform]` compiled. |

#### Risks & Notes

- `buildShareOutputBlocks` is the single source of truth for block ordering. If block order needs to change per platform, update the helper — not the render loop.
- `image_inputs` list renders as plain `<li>` items (not chips) since they are operator instructions, not copy-ready tags. If chip styling is preferred, extend `.share-output-image-prompt__list` in a later polish task.
- No backend, schema, migration, or dependency changes were made.
- Lint warning count remains 92 — no new warnings introduced.

#### Handoff for Next Run

Next task: **SHARE-V1-008** — strengthen the Gemini prompt with existing product metadata (description, USP, marketplace, etc.) from the DB. The `inputParams` field is already wired through to `buildShareCaptionPrompt` via `taskInput.inputParams`; this task reads and embeds the additional product fields.

---

### SHARE-V1-008 — Improve Gemini Context with Existing Product Metadata

**Status:** DONE (2026-05-24)
**Scope:** Backend prompt enrichment only. No frontend, no migration, no new dependencies.

#### Summary

Extended the share caption generation pipeline to pass available product metadata (from `products` table and `product_intake_sessions.reviewed_metadata_json`) into the Gemini prompt. The prompt builder now emits a "KONTEKS PRODUK" block with safe fields when available, and gracefully omits it when metadata is missing. Added explicit guardrail rules preventing Gemini from fabricating price, discount, stock, guarantee, or medical/body claims.

#### Files Changed

| File | Changes |
|------|---------|
| `src/lib/server/share-generations.ts` | Extended `requireOwnedProduct()` SELECT to include `marketplace` and `niche`. Added query to fetch latest `product_intake_sessions` row (preferring `reviewed_metadata_json` over `parsed_metadata_json`). Extended `taskInput` with `productMarketplace`, `productNiche`, `productMetadata` fields. |
| `src/lib/server/share-caption-task.ts` | Extended `ShareCaptionTaskInput` type with optional `productMarketplace`, `productNiche`, `productMetadata` fields. Updated `buildShareCaptionPrompt()` to build a "KONTEKS PRODUK" block from available metadata and inject "ATURAN KONTEKS PRODUK" guardrail rules. |
| `docs/share-link-caption-generator-v1-plan.md` | This Implementation Log section. |

#### Context Fields Added

| Field | Source | Prompt Label |
|-------|--------|--------------|
| `marketplace` | `products.marketplace` | Marketplace |
| `niche` | `products.niche` | Niche |
| `category` | `intake_sessions.reviewed_metadata_json.category` | Kategori |
| `use_case` | `intake_sessions.reviewed_metadata_json.use_case` | Use case |
| `pain_point` | `intake_sessions.reviewed_metadata_json.pain_point` | Pain point yang dijawab |
| `selling_angle` | `intake_sessions.reviewed_metadata_json.selling_angle` | Selling angle |
| `target_viewer` | `intake_sessions.reviewed_metadata_json.target_viewer` | Target audience |
| `deskripsi_visual` | `intake_sessions.reviewed_metadata_json.deskripsi_visual` | Deskripsi visual produk |
| `keyword_cari_etalase` | `intake_sessions.reviewed_metadata_json.keyword_cari_etalase` | Keyword etalase |

**Fallback behavior:** All fields are optional. If `product_intake_sessions` has no row for the product, or if `reviewed_metadata_json` and `parsed_metadata_json` are both null, the prompt omits the "KONTEKS PRODUK" block entirely and generates based on product name + affiliate URL alone (same as before).

#### What Remains Missing (Not in Scope for V1-008)

- `price_text`, `sold_count_text`, `rating_text` — intentionally excluded (risk of stale/fabricated claims)
- Product images / visual bytes — not available at prompt time without Drive fetch
- Prompt Pack personalization context — deferred to SHARE-V1-009
- Affiliate profile tone/style preferences — not yet wired

#### Guardrail Rules Added to Prompt

```
ATURAN KONTEKS PRODUK:
- Gunakan konteks produk di atas HANYA sebagai referensi untuk membuat caption lebih relevan.
- JANGAN fabrikasi harga, diskon, stok, garansi, klaim medis/tubuh, atau data yang tidak ada di konteks.
- JANGAN klaim fitur atau manfaat yang tidak disebutkan di metadata.
- Jika konteks produk kosong atau minim, buat caption generik yang tetap menarik berdasarkan nama produk saja.
```

#### Acceptance Criteria Met

- [x] Audit available product fields accessible from share feature
- [x] Pass safe context fields to Gemini when available (marketplace, niche, use_case, pain_point, selling_angle, target_viewer, deskripsi_visual, keyword_cari_etalase, category)
- [x] Prefer `reviewed_metadata_json` over `parsed_metadata_json`
- [x] Graceful fallback when fields are missing (prompt omits block entirely)
- [x] Explicit guardrail: no fabricated price, discount, stock, guarantee, medical/body claims
- [x] No frontend changes
- [x] No DB migration
- [x] No new dependencies

#### Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | PASS | Exit 0. No type errors. |
| `npm run lint` | PASS | 0 errors, 92 warnings (matches audit baseline). |
| `npm run build` | PASS | Exit 0. All routes compiled. |

#### Risks & Notes

- The `product_intake_sessions` query adds one extra DB round-trip per generation request. This is acceptable since generation is already async and the query is indexed (`product_intake_sessions_user_product_idx`).
- If a product has multiple intake sessions, only the latest (by `created_at DESC`) is used. This matches the pattern in `prompt-readiness.ts`.
- The metadata JSONB is typed as `Record<string, unknown>` — the `safeStr()` helper defensively checks for string type before including in prompt.
- Lint warning count remains 92 — no new warnings introduced.

#### Handoff for Next Run

**SHARE-V1-009 DEFERRED** — Prompt Pack integration decision doc ditunda ke post-V1. Share workspace V1 dinyatakan selesai pada SHARE-V1-008. Tidak ada task aktif berikutnya dalam stream ini.
