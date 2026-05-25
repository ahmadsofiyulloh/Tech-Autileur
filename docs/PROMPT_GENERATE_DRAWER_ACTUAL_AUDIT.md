# Prompt Generate Drawer Actual Audit

## 1. Audit Metadata

- date/time: 2026-05-24 23:02:09 +07:00
- branch: `main`
- git status summary before documentation edits: clean (`git status --short` returned no files)
- git diff summary before documentation edits: clean (`git diff --stat` returned no files)
- scope: audit and implementation plan only. No runtime code, refactor, schema change, migration, prompt generation logic change, Flow automation, or Windows Helper behavior change.

Commands used:

```bash
git status --short
git diff --stat
git branch --show-current
rg -n "Buat Prompt|Buat Ulang|Generate Prompt|Bulk Prompt|bulk|enqueue|angle|generation_options|i2i|i2v|first_frame|last_frame|prompt pack|Prompt Pack" src docs tests
rg -n "generate.*prompt|prompt.*generate|bulkEnqueue|enqueuePrompt|createPrompt|regeneratePrompt|promptPack" src
rg -n "drawer|Generate tab|tab=generate|detail panel|bottom sheet|sheet|modal" src/app src/components
rg -n "generation_options|video_mode|vo_enabled|vo_length_preset|video_model" src docs
Get-ChildItem -Path src/app/prompts -Recurse
Get-ChildItem -Path src/lib/prompts -Recurse
Get-ChildItem -Path src/lib/server -Filter "*prompt*" -Recurse
Get-ChildItem -Path src/lib/gemini -Recurse
Get-ChildItem -Path tests -Recurse | Select-String -Pattern "prompt|bulk|gemini|flow" -CaseSensitive:$false
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
```

Source-of-truth documents read:

- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `PLAYBOOK.md`
- `docs/OPENCLAUDE_WORKFLOW.md`
- `docs/PHASE_2_ARCHITECTURE_LOCK.md`
- `prompts/OPENCLAUDE_TASK_PROMPT_TEMPLATE.md`

## 2. Current Prompt Generation Flow

The current app has multiple "Buat Prompt" entry points. The main `/prompts` workbench already uses a compact floating variant picker before submitting, but there is no setup drawer and no `Generate` tab. The detail drawer has `Output`, `Regenerate`, and `History` tabs.

| Surface | File | Current action | Notes |
| --- | --- | --- | --- |
| Intake workflow success action | `src/app/products/new/intake-workflow-form.tsx:106`, `src/app/products/new/intake-workflow-form.tsx:479` | Builds a link to `/prompts?product_id=...&intake_id=...&affiliate_profile_id=...` and renders `Buat Prompt`. | This does not generate directly. It routes the operator to the prompt workbench with product context. |
| Prompt workbench create action | `src/app/prompts/prompt-workbench-list.tsx:224` | Renders `VariantSubmitButton` with `action={savePromptPack}`, `intent=create_generate`, hidden product/intake/profile/source image IDs, and `status=DRAFT`. | The visible click opens the variant picker first. Selecting a variant submits the form. There is no drawer setup step. |
| Variant picker | `src/components/operator/variant-picker.tsx:68` | Client component opens an inline floating menu for `content_variant_key`, then submits the parent form. | This is the current "angle-like" setup. It is not a drawer, sheet, or detail panel. |
| Prompt create server action | `src/app/prompts/actions.ts:567` | `savePromptPack` handles `intent=create_generate`, validates product context, creates the prompt pack, queues a generation task, and redirects to `/prompts?detail=<id>&message=...`. | Generation is queued immediately after variant selection. Redirect opens the detail drawer by query string. |
| Prompt detail drawer | `src/app/prompts/page.tsx:642` | Opens `OperatorDetailDrawer` when `?detail=<promptPackId>` is present. | Existing drawer can be reused for setup, but today it shows the created prompt pack after enqueue. |
| Prompt detail tabs | `src/app/prompts/prompt-detail-panel.tsx:53` | Tabs are `Output`, `Regenerate`, and `History`. | No `Generate` tab exists. The closest setup UI is the existing `Regenerate` tab. |
| Generation monitor | `src/app/prompts/prompt-detail-panel.tsx:239`, `src/components/operator/prompt-generation-monitor.tsx:25` | Pending prompt packs render `PromptGenerationMonitor`, which POSTs `/api/prompts/[id]/generate` and refreshes. | Runtime generation is performed by the API route after an `ai_tasks` queue entry exists. |
| Prompt generation API | `src/app/api/prompts/[id]/generate/route.ts:25` | Validates owner, prompt pack, and queued task, then runs mock or real generation. | The route delegates to `runMockPromptPackTask` or `runRealPromptPackTask`. |
| Regenerate tab action | `src/app/prompts/prompt-detail-panel.tsx:330`, `src/app/prompts/actions.ts:673` | `Buat Ulang` submits `savePromptPack` with `intent=regenerate`, creates the next version, queues a task, and redirects to `tab=output`. | This is drawer-based but exposes model and voiceover fields today. User direction says do not add duration, ratio, or model settings to the new generate setup. |
| Product detail legacy regenerate action | `src/app/products/product-detail-panel.tsx:524`, `src/app/products/actions.ts:151` | `Generate Ulang` calls `regenerateProductPrompt`, creates a next version, and runs real Gemini generation synchronously before redirect. | This is a direct generation path outside the prompt drawer and should be handled as a compatibility risk or separate follow-up. |

Prompt angle selection:

- No dedicated `angle` field for prompt generation was found in `src/app/prompts`, `src/lib/prompts`, or `src/lib/server/prompt-packs.ts`.
- The current required operator choice is `content_variant_key`, selected through `VariantSubmitButton`.
- The generated content can include product metadata such as `selling_angle`, but that is metadata output/input, not the prompt generation UI control.
- Recommendation: treat `content_variant_key` as the existing angle-like selector only if the implementation needs to preserve current behavior. Do not add a new angle schema unless a later source-of-truth update explicitly requires it.

## 3. Current Bulk Prompt Flow

Bulk Prompt exists on the `/prompts` workbench. It uses row selection and a variant picker, then directly enqueues prompt packs. There is no bulk setup drawer.

| Surface | File | Current bulk behavior | Notes |
| --- | --- | --- | --- |
| Desktop bulk selection toolbar | `src/app/prompts/prompt-workbench-list.tsx:698` | Selected product IDs are submitted with `bulkEnqueuePromptPacks`. The button text is `Antrikan`. | The button uses `VariantSubmitButton`, so content variant is selected before submit. No drawer opens. |
| Mobile bulk selection toolbar | `src/app/prompts/prompt-workbench-list.tsx:769` | Same bulk form and `VariantSubmitButton` pattern as desktop. | Same direct enqueue behavior after variant selection. |
| Bulk server action | `src/app/prompts/actions.ts:391` | `bulkEnqueuePromptPacks` validates up to 50 product IDs, reads `generation_mode`, reads `content_variant_key`, loads readiness data, calls `queuePromptPackForProduct` for each row, and redirects. | It does not read `generation_options` or video mode today. |
| Per-product bulk queue helper | `src/app/prompts/actions.ts:304` | `queuePromptPackForProduct` creates or updates one prompt pack, sets status to `QUEUED`, and calls `createPromptPackGenerationTask`. | This is the main place to pass generation setup into bulk-created prompt packs. |
| Queue drawer redirect | `src/app/prompts/prompt-workbench-list.tsx:726`, `src/app/prompts/page.tsx:654` | Hidden `return_to` points to `?queue=1`; after bulk enqueue, page opens `OperatorDetailDrawer` with the queue list. | This is a queue status drawer, not a setup drawer. User direction says bulk setup should be drawer-only before generate/enqueue, with no nav tab or redirect flow. |

## 4. Current Drawer / Tab Infrastructure

| Component | File | Current purpose | Reusable for setup? | Notes |
| --- | --- | --- | --- | --- |
| `OperatorDetailDrawer` | `src/components/operator/detail-drawer.tsx:13` | Generic detail drawer shell with title, description, close link, and children. | Yes. | Already used by prompt detail and queue. It is the best existing shell for a setup drawer. |
| Prompt detail drawer host | `src/app/prompts/page.tsx:642` | Opens prompt detail from `?detail=<id>` and queue from `?queue=1`. | Yes. | Could add a setup query such as `?generate=<productId>` or `?bulk_generate=1`, but keep it drawer-only and avoid new nav tabs. |
| Prompt detail panel tabs | `src/app/prompts/prompt-detail-panel.tsx:37` | `Output`, `Regenerate`, `History` tabs inside an existing prompt pack drawer. | Partially. | No `Generate` tab exists. If setup is for a not-yet-created prompt pack, a separate drawer body is cleaner than forcing this panel. |
| `Regenerate` tab form | `src/app/prompts/prompt-detail-panel.tsx:330` | Existing setup form for regeneration scope, model, voiceover, and revision instructions. | Partially. | Useful pattern for drawer-contained final submit. Must not copy duration, ratio, or model controls into the new generate setup. |
| Queue drawer | `src/app/prompts/page.tsx:654`, `src/app/prompts/prompt-queue-drawer.tsx:1` | Shows queued tasks and supports running next prompt generation task. | No for setup. | Keep as queue status/control surface after enqueue. Do not use it as setup UI. |
| Variant picker | `src/components/operator/variant-picker.tsx:68` | Floating content variant picker for one submit button. | Maybe. | Could be replaced by an explicit selector inside setup drawer. Existing component is not a drawer. |
| Bulk import action panel | `src/app/products/new/bulk-import-panel.tsx:575` | Each completed import row can submit `Buat Prompt`. | Maybe. | This path currently posts direct `create_generate` without `VariantSubmitButton`. It should be audited in implementation to avoid leaving a direct generation bypass. |

## 5. Current Generation Options Contract

Current `generation_options` is nested inside `prompt_packs.personalization_json`, not a dedicated column. It can likely store `video_mode` without a migration, but the current type and parser do not include it.

| Option | Exists? | Source file | Stored where | Notes |
| --- | --- | --- | --- | --- |
| `generation_options` | Yes | `src/lib/prompts/prompt-pack-contract.ts:34`, `src/lib/prompts/prompt-pack-contract.ts:47` | `prompt_packs.personalization_json.generation_options` JSONB object | Existing JSONB location. Preferred no-migration storage for video mode. |
| `vo_enabled` | Yes | `src/lib/prompts/prompt-pack-contract.ts:20`, `src/app/prompts/actions.ts:55`, `src/lib/server/prompt-packs.ts:1183` | `personalization_json.generation_options.vo_enabled` | Existing regenerate UI and server defaults use it. |
| `vo_length_preset` | Yes | `src/lib/prompts/prompt-pack-contract.ts:22`, `src/app/prompts/actions.ts:56`, `src/lib/server/prompt-packs.ts:1184` | `personalization_json.generation_options.vo_length_preset` | Existing UI options are short, medium, long. New generate drawer should not add duration setting. |
| `video_model` | Yes | `src/lib/prompts/prompt-pack-contract.ts:23`, `src/app/prompts/actions.ts:57`, `src/lib/server/prompt-packs.ts:1186` | `personalization_json.generation_options.video_model` | Existing regenerate UI exposes model generator. User direction says do not add model setting in new setup. |
| `video_mode` | No | No match in `src` or `docs` from audit command | Not stored today | Recommended JSON key if added, because existing options use snake_case. UI variable can be `videoMode`. |
| `videoMode` | No | No match in `src` or `docs` from audit command | Not stored today | Avoid camelCase in persisted JSON unless the project intentionally changes convention. |
| `generation_mode` | Yes | `src/app/prompts/actions.ts:35`, `src/app/prompts/actions.ts:409` | Form field only, used to choose mock or Gemini task mode | This is not the desired video mode. |

Persistence files:

- `supabase/migrations/20260502000005_sprint6_prompt_pipeline.sql` creates prompt pack JSON fields such as `i2i_prompts_json`, `i2v_prompts_json`, and `consistency_rules_json`.
- `supabase/migrations/20260502000011_sprint14_prompt_pack_personalization.sql` adds `personalization_json jsonb`.
- No migration is required if `video_mode` is stored under `personalization_json.generation_options`.

## 6. Current Prompt Output Contract

Actual generated/editor output fields are normalized by `src/lib/prompts/prompt-pack-contract.ts` and rendered by `src/app/prompts/prompt-output-fields.tsx`.

Operator-facing fields currently shown:

- `Caption`: rendered from `caption`.
- `Tags`: rendered from `tags`.
- `Shopee Caption+Tags`: rendered from `shopee_caption_tags`.
- `Target Marketplace`: rendered from `target_marketplace`.
- Clip group per `i2v` prompt:
  - `First Frame Image`: shown from matching `i2i_prompts[].first_frame`.
  - `I2V Prompt`: shown as structured rows from matching `i2v_prompts[]`.

Operator-facing fields currently hidden:

- `I2I Last Frame`: hidden in the UI by design but preserved in hidden form fields for save/compatibility.
- Raw JSON payloads for `i2i_prompts_json`, `i2v_prompts_json`, `consistency_rules_json`, and `negative_rules_json`.

Relevant files:

- `src/app/prompts/prompt-output-fields.tsx:68` builds hidden form fields, including first frame, last frame, and i2v payloads.
- `src/app/prompts/prompt-output-fields.tsx:116` renders caption, tags, Shopee copy, marketplace, first frame image, and I2V prompt sections.
- `src/lib/prompts/prompt-pack-contract.ts:2945` builds the storage payload and validates JSON strings before save.
- `src/lib/server/prompt-pack-generated-files.ts:54` still requires `i2i_first_frame`, `i2i_last_frame`, and `i2v` export readiness, but the TXT export only prints First Frame Image and I2V Prompt.

Implication for ingredients-to-video:

- The current UI has no direct `Ingredients Video Prompt` field.
- To hide i2i first/last operator fields for `ingredients_to_video`, rendering must branch on persisted `generation_options.video_mode`.
- Backward compatibility requires old packs without `video_mode` to default to `frame_to_video` and keep first-frame/video rendering readable.

## 7. Current Gemini Builder / Contract

The actual Gemini contract is frame-to-video oriented today.

Where instructions and schema are built:

- `src/lib/server/prompt-packs.ts:494` builds `prompt_context.prompt_writing_contract` and hardcodes Flow I2I single-frame I2V requirements.
- `src/lib/server/prompt-packs.ts:1747` builds the model context used for prompt generation, including `generation_options`.
- `src/lib/server/prompt-packs.ts:1869` builds the main Gemini prompt generation instruction.
- `src/lib/server/prompt-packs.ts:2007` builds the repair prompt instruction.
- `src/lib/gemini/json-schemas.ts:317` defines `compactPromptPackSchema`.
- `src/lib/gemini/json-schemas.ts:466` defines `promptPackSchema`.

Where i2i/i2v fields are required:

- `compactPromptPackSchema` requires top-level `i2i_prompts` and `i2v_prompts`.
- Each compact `i2i_prompts[]` item requires `clip_id`, `first_frame`, and `last_frame`.
- Each compact `i2v_prompts[]` item requires structured video prompt fields, including `clip_id`, `video_prompt`, `duration_seconds`, `camera`, `motion`, `timeline`, `audio`, and `constraints`.
- `promptPackSchema` also requires `i2i_prompts`, `i2v_prompts`, and related consistency/negative rule objects.

Where output is normalized:

- `src/lib/prompts/prompt-pack-contract.ts:2779` parses prompt pack editor output.
- `src/lib/prompts/prompt-pack-contract.ts:2898` reads existing prompt pack JSON into editor-friendly payloads.
- `src/lib/prompts/prompt-pack-contract.ts:2945` creates the storage payload for updates.
- `src/lib/server/prompt-packs.ts:2163` persists generated prompt pack results and preserves personalization JSON.

Can `ingredients_to_video` be added without migration?

- Yes for setup persistence if stored as `personalization_json.generation_options.video_mode`.
- Not yet for Gemini output without code changes, because current schemas and normalizers require frame-to-video i2i/i2v structures.
- The least disruptive compatibility path is to keep legacy `i2i_prompts` and `i2v_prompts` readable, then add an ingredients-mode output field inside existing JSON structures or a backward-compatible optional field in `personalization_json`/prompt payload. The exact field must be decided during implementation after tests are updated.

Backward compatibility requirements:

- Packs without `generation_options.video_mode` must render and export as current frame-to-video packs.
- Existing hidden `I2I Last Frame` storage must not be removed.
- Flow stage contracts (`FIRST_FRAME`, `LAST_FRAME`, `VIDEO`) must remain valid for old prompt packs and existing manifests.
- Product detail legacy `Generate Ulang` must not be broken by new setup-first work, even if it is later moved behind a drawer.

## 8. Desired Change Mapped to Actual Code

Minimal audit-backed change:

- Change the `/prompts` `Buat Prompt` path from `VariantSubmitButton -> savePromptPack(create_generate)` to `open setup drawer -> submit final generate`.
- Reuse `OperatorDetailDrawer` rather than introducing a new modal system.
- Keep the existing prompt detail drawer and queue drawer behavior after enqueue.
- Add only a video mode selector in the setup drawer:
  - `ingredients_to_video`
  - `frame_to_video`
- Keep the existing content variant selector if the current prompt code still requires it. Do not add a separate prompt angle field.
- Do not add duration, aspect ratio, or model settings to the new create/bulk setup drawer.
- Bulk Prompt should open the setup drawer first, collect video mode and the existing content variant if needed, then call `bulkEnqueuePromptPacks`.
- Bulk setup should not add a nav tab, persistent route section, or redirect-only setup page.
- Store `video_mode` in `prompt_packs.personalization_json.generation_options` if implementation confirms no migration is needed.
- Default missing `video_mode` to `frame_to_video`.
- For `ingredients_to_video`, output UI should hide first-frame/last-frame operator-facing prompt sections where safe and show a direct `Ingredients Video Prompt`.
- Gemini builder and schema work must be a separate implementation task because the current contract requires i2i/i2v output.
- Old `FIRST_FRAME`, `LAST_FRAME`, and `VIDEO` readability must remain intact.

Exact current files likely affected later:

- `src/app/prompts/page.tsx`
- `src/app/prompts/prompt-workbench-list.tsx`
- `src/app/prompts/actions.ts`
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-output-fields.tsx`
- `src/components/operator/detail-drawer.tsx` only if the existing drawer shell needs a small prop extension
- `src/components/operator/variant-picker.tsx` only if the picker is reused inside the drawer
- `src/lib/prompts/prompt-pack-contract.ts`
- `src/lib/server/prompt-packs.ts`
- `src/lib/gemini/json-schemas.ts`
- `src/lib/flow/stage-manifest.ts` only if Flow export needs a new ingredients stage in a later approved task
- `src/lib/server/flow-manifests.ts` only if Flow manifest validation changes in a later approved task

## 9. Recommended Implementation Plan

### PROMPT-DRAWER-001: audit-backed docs and exact file map

- goal: Record the actual current prompt generation, bulk, drawer, options, output, Gemini, and Flow contracts before runtime changes.
- exact likely files: `docs/PROMPT_GENERATE_DRAWER_ACTUAL_AUDIT.md`, `docs/CHANGELOG.md`.
- risk level: Low.
- acceptance criteria: Audit doc exists, includes current flow tables, no-migration assessment, implementation plan, and verification results. Changelog entry references the audit.
- out of scope: Runtime code, schema, migrations, prompt logic, UI behavior changes.
- verification commands: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`.
- rollback notes: Remove the audit doc and changelog entry only if the audit is superseded by a newer approved plan.

### PROMPT-DRAWER-002: add minimal videoMode contract using existing generation_options, no migration

- goal: Add a typed `video_mode`/UI `videoMode` contract backed by `personalization_json.generation_options`, defaulting to `frame_to_video`.
- exact likely files: `src/lib/prompts/prompt-pack-contract.ts`, `src/app/prompts/actions.ts`, `src/lib/server/prompt-packs.ts`, related tests under `tests/e2e` if they assert generation options.
- risk level: Medium.
- acceptance criteria: Existing packs without `video_mode` still behave as frame-to-video. New prompt pack creation/regeneration can persist `video_mode` under existing JSONB. No migration is added.
- out of scope: Gemini schema changes, output rendering changes, drawer UX changes.
- verification commands: `npm run lint`, `npm run typecheck`, `npm run build`, targeted prompt tests if present.
- rollback notes: Remove the new optional key and parser branch; because storage is JSONB, stale `video_mode` keys can be ignored safely.

### PROMPT-DRAWER-003: change Buat Prompt action to open setup drawer, no backend logic change

- goal: Replace direct create/enqueue submit on `/prompts` with a setup drawer open action while preserving final form submission behavior.
- exact likely files: `src/app/prompts/page.tsx`, `src/app/prompts/prompt-workbench-list.tsx`, possible new component `src/app/prompts/prompt-generate-setup-drawer.tsx`, `src/components/operator/variant-picker.tsx` only if reused.
- risk level: Medium.
- acceptance criteria: Clicking `Buat Prompt` opens a drawer. No generation is queued until the operator confirms inside the drawer. Existing product context is preserved. Loading, empty, and error states are present.
- out of scope: Ingredients-mode Gemini generation, output hiding, bulk setup, schema changes.
- verification commands: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`, relevant Playwright smoke when practical.
- rollback notes: Restore the previous `VariantSubmitButton` form submit path.

### PROMPT-DRAWER-004: add videoMode selector in drawer

- goal: Add only the approved mode choice in the setup drawer: `ingredients_to_video` or `frame_to_video`.
- exact likely files: setup drawer component, `src/app/prompts/actions.ts`, `src/lib/prompts/prompt-pack-contract.ts`.
- risk level: Medium.
- acceptance criteria: Drawer has a token-compliant selector. It does not expose duration, aspect ratio, or model. It preserves current content variant selection only if needed by actual prompt code.
- out of scope: Gemini schema/output implementation, bulk setup.
- verification commands: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`.
- rollback notes: Hide the selector and default all submissions to `frame_to_video`.

### PROMPT-DRAWER-005: change bulk prompt to open drawer setup before enqueue/generate

- goal: Make selected-row bulk prompt flow open a drawer-only setup before calling `bulkEnqueuePromptPacks`.
- exact likely files: `src/app/prompts/page.tsx`, `src/app/prompts/prompt-workbench-list.tsx`, setup drawer component, `src/app/prompts/actions.ts`.
- risk level: High.
- acceptance criteria: Bulk selected rows are preserved into the drawer. Final submit enqueues only after setup confirmation. No nav tab or setup redirect page is added. Queue drawer behavior after enqueue remains available.
- out of scope: Bulk history redesign, queue runner changes, schema changes.
- verification commands: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`, prompt workbench e2e if present.
- rollback notes: Restore current selected-row `VariantSubmitButton` submit path.

### PROMPT-DRAWER-006: update Gemini builder contract for ingredients_to_video vs frame_to_video

- goal: Branch Gemini instructions and schema/normalization so `ingredients_to_video` can produce a direct Ingredients Video Prompt while frame-to-video keeps first-frame plus video prompt output.
- exact likely files: `src/lib/server/prompt-packs.ts`, `src/lib/gemini/json-schemas.ts`, `src/lib/prompts/prompt-pack-contract.ts`, prompt generation tests.
- risk level: High.
- acceptance criteria: `frame_to_video` output remains backward compatible. `ingredients_to_video` output parses deterministically. Repair prompt supports both modes. Structured JSON schema failures are tested.
- out of scope: UI drawer behavior, Flow automation, migration.
- verification commands: `npm run lint`, `npm run typecheck`, `npm run build`, targeted Gemini/prompt generation tests.
- rollback notes: Default all generated prompt packs to frame-to-video schema and ignore ingredients-mode output keys.

### PROMPT-DRAWER-007: update output UI to hide i2i fields for ingredients_to_video and show Ingredients Video Prompt

- goal: Render mode-aware output while preserving legacy frame-to-video readability.
- exact likely files: `src/app/prompts/prompt-output-fields.tsx`, `src/lib/prompts/prompt-pack-contract.ts`, `src/lib/server/prompt-pack-generated-files.ts`, possibly Flow export code if approved.
- risk level: High.
- acceptance criteria: Ingredients mode shows direct Ingredients Video Prompt and hides i2i first/last operator fields where safe. Frame-to-video still shows First Frame Image and I2V Prompt. Hidden compatibility fields remain preserved.
- out of scope: New Flow stage automation, schema migration.
- verification commands: `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`, visual smoke if practical.
- rollback notes: Fall back to existing frame-to-video rendering for all packs.

### PROMPT-DRAWER-008: verify old prompt packs and legacy flow compatibility

- goal: Add/extend tests and manual checks for existing prompt packs, old JSON shapes, product detail legacy regenerate, queue runner, and Flow manifest compatibility.
- exact likely files: `tests/e2e/gemini-backend-hardening.spec.ts`, `tests/e2e/intake-prompt-live-loop.spec.ts`, `tests/e2e/bulk-import-prompt-readiness.spec.ts`, `tests/e2e/flow-manifest-validation.spec.ts`, docs handoff notes.
- risk level: Medium.
- acceptance criteria: Old packs without `video_mode` remain readable. `FIRST_FRAME`, `LAST_FRAME`, and `VIDEO` exports still validate. Existing direct/legacy paths are either updated or explicitly documented as remaining exceptions.
- out of scope: New runtime features beyond compatibility verification.
- verification commands: `npm run lint`, `npm run typecheck`, `npm run build`, relevant Playwright smoke tests.
- rollback notes: Revert test expectations and disable ingredients-mode branches by default.

## 10. No-Migration Assessment

- Can this be done without schema migration? Yes, for setup persistence and mode selection, if the app stores the new mode in existing `prompt_packs.personalization_json.generation_options`.
- Which existing JSONB/object can store videoMode? `personalization_json.generation_options`, with a recommended persisted key of `video_mode` and allowed values `ingredients_to_video` or `frame_to_video`.
- What is the fallback if `generation_options` is missing? Treat missing `generation_options` or missing `video_mode` as `frame_to_video`, because that is the current behavior and current Gemini contract.
- What should be blocked if migration seems required? Block and ask for approval if implementation requires querying/filtering by video mode at database level, adding a dedicated column, changing prompt pack table shape, changing Flow manifest tables, or storing large generated assets outside existing JSON/Drive contracts.

## 11. Risks

- Direct generation regression risk: There are several create/regenerate entry points. `/prompts` can be moved to setup-first, but bulk import and product detail legacy regeneration can remain bypasses unless explicitly included.
- Bulk enqueue regression risk: Current bulk flow depends on selected product IDs, hidden `return_to`, `generation_mode`, and `content_variant_key`. A drawer must preserve all of those without losing selection state on mobile or desktop.
- Old prompt pack rendering risk: Old packs have no `video_mode` and expect i2i/i2v fields. The fallback must be frame-to-video.
- Gemini schema/parse risk: Current schemas require `i2i_prompts` and `i2v_prompts`; ingredients-to-video needs a carefully branched schema and repair path.
- Flow manifest compatibility risk: Current manifest stages are `FIRST_FRAME`, `LAST_FRAME`, and `VIDEO`; ingredients-to-video may not map cleanly without a later approved manifest design.
- Hidden i2i UI risk: Last-frame fields are hidden but preserved today. Hiding more i2i fields for ingredients mode must not delete required storage or export compatibility data.
- Mobile drawer UX risk: The setup drawer must remain usable at 360px and not introduce dense tables, large forms, or nav-tab setup flow.
- Existing model UI risk: The existing `Regenerate` tab exposes `video_model`. New setup must not add model UI, and any removal from regenerate should be a separate explicitly approved task because it changes existing behavior.

## 12. Verification Results

- `npm run audit:colors`: passed. Output: `Hardcoded color audit passed.`
- `npm run audit:typography`: passed. Output: `Hardcoded typography audit passed.`
- `npm run audit:neutral-ui`: passed. Output: `Neutral UI token audit passed.`
- `npm run typecheck`: passed. Output: `tsc --noEmit`.
- `npm run lint`: first run timed out at 120 seconds without diagnostics. Rerun with a 300 second timeout passed with existing warnings only: `95 problems (0 errors, 95 warnings)`, `0 errors and 8 warnings potentially fixable with the --fix option`.
- `npm run build`: passed. `prebuild` wrote `public\release-meta.json (2026.05.24.26)`, then Next.js 16.2.4 compiled, ran TypeScript, generated 16 static pages, and finalized page optimization successfully.
- Post-verification git status: only `docs/CHANGELOG.md` modified and `docs/PROMPT_GENERATE_DRAWER_ACTUAL_AUDIT.md` untracked/created.
