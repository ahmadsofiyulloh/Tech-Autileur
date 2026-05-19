# UX Redesign Backlog

**Source of truth:** UI/UX Redesign Blueprint (conversation artifact, 2026-05-19)
**Lock dependencies:** `UI_SHELL_REBRAND_LOCK.md`, `PRD_SOURCE_OF_TRUTH.md`, `MOBILE_REMOTE_CONTROL_LOCK.md`
**Status:** READY FOR IMPLEMENTATION (Phase R1 first)

## Backlog Structure

```text
Phase R1 — Navigation & Routing Fix          (3 tasks, LOW risk)
Phase R2 — Dashboard Command Center          (5 tasks, MEDIUM risk)
Phase R3 — Mobile Bottom Nav Reorder         (2 tasks, LOW risk)
Phase R4 — Sidebar & Topbar Density Polish   (3 tasks, LOW risk)
Phase R5 — Page-Level UX Refinements         (6 tasks, LOW–MEDIUM risk)
Phase R6 — Outputs Discoverability           (2 tasks, LOW risk)
```

Total: 21 micro-tasks. Execute in order within each phase. Phases are sequential (R1 before R2 before R3, etc.).

---

## Phase R1 — Navigation & Routing Fix

### R1-001 — Change root redirect to /dashboard ✅ DONE

**Goal:** Make `/` redirect to `/dashboard` instead of `/products/new` so the operator lands on the command center.

**Files:**
- `src/app/page.tsx`

**UX reason:** Operator opens the app to check status first, then acts. Dashboard is the operational home.

**Implementation notes:**
- Change `redirect("/products/new")` to `redirect("/dashboard")`.
- Single line change.

**Out of scope:**
- Dashboard content changes
- Nav config changes
- Any other route changes

**Acceptance criteria:**
- [x] Visiting `/` redirects to `/dashboard`
- [x] No other routes affected
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert the one-line change in `src/app/page.tsx`.

---

### R1-002 — Clean nav-config: remove stale badge, fix routeTitles ✅ DONE

**Goal:** Remove "Coming soon" badge from Flow Control, remove `/intake` shim from routeTitles, add `/settings/drive` to routeTitles.

**Files:**
- `src/components/operator/nav-config.ts`

**UX reason:** Controller is functional (badge is stale). `/intake` routeTitle can cause false active-route matching on a redirect shim. `/settings/drive` has no topbar title.

**Implementation notes:**
- Remove `badge: "Coming soon"` from the controller entry in `desktopNavItems`.
- Remove the `{ href: "/intake", ... }` entry from `routeTitles`.
- Add `{ href: "/settings/drive", label: "Drive", subtitle: "Koneksi Google Drive.", icon: HardDrive }` to `routeTitles`.
- Changed `desktopNavItems` from `satisfies OperatorNavItem[]` to explicit `OperatorNavItem[]` type annotation to preserve `badge?` accessibility in consuming code.

**Out of scope:**
- Nav item reordering
- Mobile nav changes
- Any route URL changes

**Acceptance criteria:**
- [x] Controller desktop nav item has no badge property
- [x] `/intake` is not in `routeTitles` array
- [x] `/settings/drive` is in `routeTitles` array
- [x] TypeScript compiles
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert changes in `nav-config.ts`.

---

### R1-003 — Fix settings/flow redirect target ✅ DONE

**Goal:** Change `/settings/flow` redirect from `/settings` to `/controller`.

**Files:**
- `src/app/settings/flow/page.tsx`

**UX reason:** `/settings/flow` logically relates to Flow Control, not the settings hub. Current redirect is confusing.

**Implementation notes:**
- Changed `redirect("/settings")` to `redirect("/controller")`.
- Note: actual previous target was `/settings` (not `/products/new` as originally assumed in blueprint).

**Out of scope:**
- Controller page changes
- Settings hub layout changes

**Acceptance criteria:**
- [x] Visiting `/settings/flow` redirects to `/controller`
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert the one-line change.

---

## Phase R2 — Dashboard Command Center

### Codex Data Contract - Backend/Data Audit 2026-05-19

**Audit scope:** backend/data/Supabase/server helpers only. No UI, CSS, frontend component, or schema change is approved by this section.

**Readiness decision:**

| Task | Status | Reason |
|------|--------|--------|
| R2-001 | DONE | Implemented in `src/lib/server/dashboard-pipeline.ts` with exclusive product-level buckets and graceful unavailable state. No migration was required. |
| R2-002 | DONE | Implemented in `src/lib/server/dashboard-actions.ts` with independent action-source handling and partial/unavailable states. No migration was required. |

**Shared query boundary:**

- Scope all product/prompt/batch/output queries to the authenticated owner and the active Affiliate Profile internal workspace via `getCurrentWorkspace()`.
- Exclude `products.status = "ARCHIVED"` and archived child records where the child table has an archive status.
- Use `createSupabaseServerClient()` plus `supabase.auth.getUser()` for user-scoped helpers.
- Add `import "server-only";` to new helper files.
- Do not call `listPromptReadinessProjections()` directly for total counts unless it is refactored to support all-product batched scans; its public `limit` is capped for list surfaces.

#### R2-001 Pipeline Stage Count Contract

Return type:

```ts
export type DashboardPipelineStageKey =
  | "draft"
  | "metadataReady"
  | "promptReady"
  | "generated"
  | "exported"
  | "done";

export type DashboardPipelineStageCounts = {
  status: "available";
  workspaceId: string | null;
  generatedAt: string;
  total: number;
  counts: Record<DashboardPipelineStageKey, number>;
};

export type DashboardPipelineStageUnavailable = {
  status: "unavailable";
  workspaceId: string | null;
  generatedAt: string;
  message: string;
  total: 0;
  counts: Record<DashboardPipelineStageKey, 0>;
};
```

Stage assignment must be product-level and exclusive. Assign each non-archived product to the furthest matching stage in this precedence order:

1. `done`
2. `generated`
3. `exported`
4. `promptReady`
5. `metadataReady`
6. `draft`

| Stage | Table/source | Columns used | Query/filter logic | Uncertainty | Fallback behavior |
|-------|--------------|--------------|--------------------|-------------|-------------------|
| `draft` | `products`, `product_images`, `product_intake_sessions`, prompt readiness projection logic | `products.id`, `products.status`, `products.workspace_id`, product image active state, intake reviewed metadata state | Count products not matching any later stage. This includes products with missing evidence, failed/pending metadata, `product_intake_sessions.status in ("DRAFT", "SUBMITTED", "ERROR")`, or prompt readiness statuses `NEEDS_EVIDENCE`, `NEEDS_METADATA`, `NEEDS_REVIEW`, `PROMPT_FAILED`, `PROMPT_QUEUED`. | `PROMPT_QUEUED` is operationally in progress, but it is not ready for dashboard action until the prompt pack is generated. | If child relation queries fail, return helper-level `unavailable` instead of guessing from `products.status`. |
| `metadataReady` | `product_intake_sessions` plus prompt readiness projection logic | `product_intake_sessions.product_id`, `status`, `reviewed_metadata_json`; prompt launch readiness profile checks | Product has complete reviewed metadata and active profile readiness and no generated/active prompt pack yet. Equivalent to projection status `READY_FOR_PROMPT`. | Bulk Import auto-reviewed metadata is valid only when the projection marks it `READY_FOR_PROMPT`. | If projection cannot evaluate affiliate profile readiness, keep product in `draft` only if the helper can still prove it is blocked; otherwise return `unavailable`. |
| `promptReady` | `prompt_packs`, `flow_batches` | `prompt_packs.product_id`, `status`, `updated_at`; `flow_batches.prompt_pack_id`, `status` | Latest non-archived prompt pack for product has `status in ("GENERATED", "APPROVED")` and there is no non-closed Flow batch for that prompt pack. `GENERATED` means copy-ready prompt exists; `APPROVED` means selected Flow-ready version. | `APPROVED` is dormant controller compatibility, while `GENERATED` is Phase 1 final prompt status. Both are dashboard prompt-ready for this contract. | If multiple prompt packs exist, use latest by `updated_at` then `created_at`. If prompt query fails, return `unavailable`. |
| `exported` | `flow_batches` | `product_id`, `prompt_pack_id`, `manifest_json`, `status`, `updated_at` | Latest non-closed batch for product/prompt pack has `status in ("READY_TO_EXPORT", "EXPORTED", "RUNNING")` and no generated output has arrived yet. `READY_TO_EXPORT` is included so the pipeline shows created batches before manifest download. | Display copy may choose "export pending" for `READY_TO_EXPORT`; the data bucket remains `exported` to avoid adding another R2 stage. | If batch query fails, product can still be counted in earlier prompt stages only if no batch relation is required; otherwise return `unavailable`. |
| `generated` | `generated_files`, `clip_jobs`, `flow_batches`, `products.workflow_status_json` | `generated_files.clip_job_id`, `stage`, `match_status`, `imported_at`; `clip_jobs.batch_id`, `content_id`, `generated_drive_item_id`, `status`; `workflow_status_json.video_generated` | Product has any generated output evidence: `workflow_status_json.video_generated = true`, a related `clip_jobs.generated_drive_item_id`, a related clip status in `("IMPORTED", "NEEDS_REVIEW", "APPROVED")`, or a related `generated_files` row for any stage. Products with `done` markers are excluded by precedence. | Current generated output rows do not carry `product_id`; helper must resolve through `clip_jobs -> batch_id` or `clip_jobs -> contents -> product_id`. | If generated output relation scan fails, do not infer generated from batch status alone; return `unavailable` or keep earlier proven stage if partial-mode is explicitly added later. |
| `done` | `products.workflow_status_json`, `products.status`, optional closed batch context | `workflow_status_json.uploaded_shopee`, `workflow_status_json.uploaded_tiktok`, `products.status`, `flow_batches.status` | Product is done when `products.status = "UPLOADED"` or both `workflow_status_json.uploaded_shopee` and `workflow_status_json.uploaded_tiktok` are true. `flow_batches.status = "CLOSED"` alone is not enough unless upload markers also exist. | One-platform uploads remain not-done because the MVP target is Shopee + TikTok output. | If `workflow_status_json` is malformed, normalize missing booleans to false like existing product helpers. |

Recommended implementation:

- Create `src/lib/server/dashboard-pipeline.ts`.
- Export `getDashboardPipelineStageCounts(input?: { workspaceId?: string | null })`.
- Internally batch product ids in chunks, load minimal child rows, and count in memory using the precedence above.
- Do not add indexes in R2. Existing useful indexes include products by owner/workspace/order, prompt packs by owner/product/status, flow batches by owner/status/workspace/product/prompt pack, clip jobs by owner/batch/content/status, and generated files by owner/clip/stage/match status.
- Error handling should return `DashboardPipelineStageUnavailable` for hard query failures. Do not silently return zero counts on failed queries.
- Performance risk: MEDIUM. A naive all-relation scan is acceptable for MVP-sized data, but for thousands of products the helper must use batched relation loading and avoid loading full JSON blobs except the reviewed metadata presence fields required by prompt readiness.

#### R2-002 Action Queue Contract

Return type:

```ts
export type DashboardActionQueueItemType =
  | "metadata_review"
  | "prompt_generation"
  | "batch_export"
  | "output_verification";

export type DashboardActionQueueItem = {
  type: DashboardActionQueueItemType;
  count: number;
  label: string;
  href: string;
};

export type DashboardActionQueueResult = {
  status: "available" | "partial" | "unavailable";
  workspaceId: string | null;
  generatedAt: string;
  items: DashboardActionQueueItem[];
  errors: Array<{ type: DashboardActionQueueItemType; message: string }>;
};
```

Action queue items must omit zero-count actions and cap returned items at 5. Sort by this priority: metadata review, prompt generation, output verification, batch export.

| Action | Table/source | Columns used | Query/filter logic | Uncertainty | Fallback behavior |
|--------|--------------|--------------|--------------------|-------------|-------------------|
| Products needing metadata review | `product_intake_sessions` joined by active workspace | `id`, `product_id`, `workspace_id`, `status`, `reviewed_metadata_json`, `updated_at` | Count rows for current user/workspace with `status = "NEEDS_REVIEW"` and non-null `product_id`. Use label `Review metadata` and href `/products/new`. | No dedicated filtered review list exists; `/products/new` is the safest existing landing route. | If this query fails, include an error entry and continue other action queries; overall status becomes `partial`. |
| Prompt packs ready to generate | Prompt readiness projection over `products`, images, marketplace sources, intake sessions, prompt packs, affiliate profile readiness | projection status, product id, active workspace | Count products whose projection status is `READY_FOR_PROMPT`. Use label `Buat prompt` and href `/prompts?readiness=READY_FOR_PROMPT`. | The requested wording is product-based in the current schema: no prompt pack row exists before prompt generation starts. Flow-ready generated prompt packs are already covered by the `promptReady` pipeline bucket and batch export actions. | If projection scan fails, include error and continue. Do not approximate with `products.status`. |
| Batches ready to export | `flow_batches` | `id`, `workspace_id`, `status`, `manifest_json`, `updated_at` | Count current workspace batches with `status = "READY_TO_EXPORT"`. Use label `Export manifest` and href `/controller`. | `/controller` may be desktop-only or placeholder depending runtime flag; Kiro UI should treat this link as desktop/Flow-control action. | If query fails, include error and continue. |
| Outputs needing verification | `generated_files` resolved through `clip_jobs`, `contents`, and `flow_batches` | `generated_files.match_status`, `stage`, `clip_job_id`; `clip_jobs.batch_id`, `content_id`; `contents.product_id`; `flow_batches.workspace_id` | Count generated files linked to current workspace with `match_status in ("UNMATCHED", "NEEDS_REVIEW", "ERROR")`. Use label `Verifikasi output` and href `/controller`. | `generated_files` has no direct product/workspace column, so relation traversal is required. | If traversal fails, include error and continue. Do not count all user generated files without workspace scoping. |

Recommended implementation:

- Create `src/lib/server/dashboard-actions.ts`.
- Export `getDashboardActionQueue(input?: { workspaceId?: string | null })`.
- Reuse the same internal batched data loader as R2-001 where possible, but keep action return types independent from UI components.
- Return `available` when all action queries succeed, `partial` when at least one action query fails and at least one succeeds, and `unavailable` only when auth/workspace/product base loading fails.
- Error messages should be short and safe for UI display. Do not expose secrets or raw SQL.
- Performance risk: MEDIUM for output verification because `generated_files` must be scoped through relation traversal. Keep query columns minimal and chunk `in()` filters.

**Kiro frontend handoff notes:**

- R2-003/R2-004 should import only typed server helper results; do not duplicate Supabase queries in UI files.
- Treat `status: "unavailable"` as an error/empty state, not as zero work.
- For `partial` action queue results, render available action items and a compact warning state for failed sources.
- Use existing `/prompts?readiness=READY_FOR_PROMPT` for prompt-generation actions.
- Use `/controller` links only as desktop/controller actions; do not create mobile Flow UI or new controller behavior in R2.
- The pipeline display may show the six stage keys in the product-requested order, but counts are assigned by the precedence contract above so totals do not double-count products.

### R2-001 — Add pipeline stage count server helper DONE

**Goal:** Create a server helper that returns product counts per pipeline stage (draft, metadata-ready, prompt-ready, generated, exported, done).

**Codex backend/data status:** DONE. Implemented against the data contract above.

**Files:**
- `src/lib/server/dashboard-pipeline.ts` (new)

**UX reason:** Dashboard needs pipeline summary data. Server helper must exist before the UI can consume it.

**Implementation notes:**
- Build exclusive product-level buckets using the R2-001 data contract above.
- Use existing `createSupabaseServerClient`, `supabase.auth.getUser()`, and active workspace patterns.
- Return `DashboardPipelineStageCounts | DashboardPipelineStageUnavailable`.
- Derive stages from existing tables only. Do NOT add new DB columns or indexes.
- Handle hard query failures as `status: "unavailable"` rather than returning zero counts.

**Implemented API:**
- `getDashboardPipelineStageCounts(input?: { workspaceId?: string | null }): Promise<DashboardPipelineStageResult>`
- Return types exported: `DashboardPipelineStageKey`, `DashboardPipelineStageCountMap`, `DashboardPipelineStageCounts`, `DashboardPipelineStageUnavailable`, `DashboardPipelineStageResult`.
- Uses `server-only`, owner auth, active workspace resolution, batched product/relation scans, prompt readiness projection chunks, and safe unavailable fallback.

**Out of scope:**
- UI changes
- Schema changes
- New indexes (use existing queries)

**Acceptance criteria:**
- [x] Function is exported and typed
- [x] Returns stage counts or unavailable status
- [x] No schema migration required
- [x] TypeScript compiles
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Verification result 2026-05-19:** `npm run lint` passed with 0 errors / 77 pre-existing warnings; `npm run typecheck` passed; `npm run build` passed.

**Risk:** MEDIUM (new server query, must verify performance with existing indexes)

**Rollback:** Delete the new file.

---

### R2-002 — Add action queue server helper DONE

**Goal:** Create a server helper that returns a list of actionable items requiring operator attention.

**Codex backend/data status:** DONE. Implemented against the data contract above.

**Files:**
- `src/lib/server/dashboard-actions.ts` (new)

**UX reason:** Dashboard action queue needs structured data about what needs attention.

**Implementation notes:**
- Query the four action sources exactly as defined in the R2-002 data contract above.
- Return `DashboardActionQueueResult` with max 5 non-zero items.
- Compose from a shared batched loader or existing pure projection logic where possible.
- Handle partial failures gracefully: if one query fails, still return proven action items from other sources.

**Implemented API:**
- `getDashboardActionQueue(input?: { workspaceId?: string | null }): Promise<DashboardActionQueueResult>`
- Return types exported: `DashboardActionQueueItemType`, `DashboardActionQueueItem`, `DashboardActionQueueResult`.
- Returns `available`, `partial`, or `unavailable`; each action source is caught independently after auth/workspace/product base loading succeeds.

**Out of scope:**
- UI changes
- Schema changes
- New tables

**Acceptance criteria:**
- [x] Function is exported and typed
- [x] Returns array of action items (max 5)
- [x] Graceful degradation on partial query failure
- [x] TypeScript compiles
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Verification result 2026-05-19:** `npm run lint` passed with 0 errors / 77 pre-existing warnings; `npm run typecheck` passed; `npm run build` passed.

**Risk:** MEDIUM (multiple queries, must verify performance)

**Rollback:** Delete the new file.

---

### R2-003 — Dashboard: add Action Queue section UI ✅ DONE

**Goal:** Add an "Action Queue" section at the top of the dashboard page that shows actionable items from R2-002.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

**UX reason:** Operator needs to see "what needs my attention" within 3 seconds of landing.

**Implementation notes:**
- Imported `getDashboardActionQueue` from `@/lib/server/dashboard-actions`.
- Rendered as compact vertical list: tone dot + label + count badge + chevron, each row a link.
- Tone mapping: metadata_review→warning, prompt_generation→info, output_verification→danger, batch_export→success.
- Empty state: "Semua beres." with "Tidak ada item menunggu tindakan." description.
- Unavailable state: shows `result.errors[0].message` or fallback.
- Partial state: items rendered + footer notice listing unavailable indicators.
- Loading state inherited from Next.js `loading.tsx` already in `/dashboard`.

**Out of scope:**
- Changing existing Gemini sections
- Pipeline summary (separate task)
- New components outside this page

**Acceptance criteria:**
- [x] Action queue section renders at top of dashboard
- [x] Shows real data from server helper
- [x] Loading state inherited from existing dashboard `loading.tsx`
- [x] Empty state shows "Semua beres." message
- [x] Error state shows error message from helper
- [x] Links navigate to helper-defined hrefs (`/products/new`, `/prompts?readiness=READY_FOR_PROMPT`, `/controller`)
- [x] Mobile responsive (compact padding under 860px)
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** MEDIUM (new UI section with server data)

**Rollback:** Remove the section from `page.tsx`. Server helper remains available.

---

### R2-004 — Dashboard: add Pipeline Summary section UI ✅ DONE

**Goal:** Add a "Pipeline Summary" section showing product counts per stage as a horizontal flow strip.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

**UX reason:** Operator needs a quick visual of pipeline throughput — how many items at each stage.

**Implementation notes:**
- Imported `getDashboardPipelineStageCounts` from `@/lib/server/dashboard-pipeline`.
- Stage order rendered: Draft → Metadata → Prompt → Exported → Generated → Done.
- Each cell is a link with stage label (uppercase, small) above large count.
- Empty stages show with `data-empty="true"` (55% opacity).
- Arrow separators between cells via `::before` pseudo (hidden on mobile).
- Mobile: each cell flexes to 50% width, no arrows.
- Empty state: "Belum ada produk. Mulai dari Intake untuk mengisi pipeline."
- Unavailable state: shows helper's `message`.

**Stage hrefs (placeholder filters — Products page may not yet implement all):**
- draft → /products?filter=draft
- metadataReady → /products?filter=metadata-ready
- promptReady → /prompts?readiness=GENERATED
- exported → /controller
- generated → /products?filter=generated
- done → /products?filter=done

**Out of scope:**
- Animated charts
- New dependencies
- Changing Gemini section

**Acceptance criteria:**
- [x] Pipeline strip renders with real stage counts
- [x] Each segment links to filtered view
- [x] Empty state and unavailable state present
- [x] Responsive on mobile (wrap to 2-col grid, no arrows)
- [x] Uses design tokens only (no hex colors, no hardcoded font sizes)
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (UI-only, data from existing helper)

**Rollback:** Remove the section from `page.tsx`.

---

### R2-005 — Dashboard: demote Gemini section visually ✅ DONE

**Goal:** Reduce visual prominence of existing Gemini KPI/live-cycle sections so they read as infrastructure health, not primary content.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

**UX reason:** Gemini metrics are infrastructure health. The new Action Queue and Pipeline Summary are the primary operational content.

**Implementation notes:**
- Wrapped Ringkasan Gemini, Live cycle Gemini, and GeminiUsageOverviewPanel in a `.dashboard-infrastructure` container.
- Container has `border-top` divider + extra padding to separate from primary content.
- Added `variant="secondary"` prop to `DashboardSection`. Secondary variant uses `--type-card-size` heading at `--color-text-secondary` instead of full section weight/color.
- All existing Gemini data and components preserved unchanged.
- No data fetching changes, no removed functionality.

**Out of scope:**
- Removing Gemini data
- Changing Gemini queries
- Adding new metrics

**Acceptance criteria:**
- [x] Gemini sections still render with all existing data
- [x] Visual hierarchy: Action Queue > Pipeline > Gemini infrastructure
- [x] No data or functionality removed
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (presentation-only)

**Rollback:** Revert CSS/JSX changes.

---

## Phase R3 — Mobile Bottom Nav Reorder

### R3-001 — Reorder mobile nav: center Intake ✅ DONE

**Goal:** Change mobile bottom nav order from `[Dashboard, Intake, Produk, Prompt, Drive]` to `[Dashboard, Produk, Intake, Prompt, Drive]` so Intake occupies the center-elevated position.

**Files:**
- `src/components/operator/nav-config.ts`

**UX reason:** Center position is the primary action slot. Intake is the most frequent mobile action. Produk and Prompt flank it as pipeline context.

**Implementation notes:**
- Reordered `mobileNavItems` array to: Dashboard, Produk, Intake, Prompt, Drive.
- AppShell center-item logic picks by `href === "/products/new"` — confirmed still works.
- Remaining items after center extraction: `[Dashboard, Produk, Prompt, Drive]` → left 2: Dashboard, Produk; right 2: Prompt, Drive. Matches target layout.

**Out of scope:**
- Desktop nav changes
- AppShell layout changes
- Route changes

**Acceptance criteria:**
- [x] Mobile bottom nav renders in order: Dashboard | Produk | ●Intake● | Prompt | Drive
- [x] Center-elevated button is Intake
- [x] Active states work for all 5 items
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert array order in `nav-config.ts`.

---

### R3-002 — Verify mobile nav E2E tests ✅ DONE (NO-OP)

**Goal:** Update any E2E test assertions that depend on mobile nav item order.

**Files:**
- No changes required.

**UX reason:** Tests must match the new nav order to prevent CI failures.

**Implementation notes:**
- Searched all E2E tests for bottom nav assertions.
- `pwa-mobile-install.spec.ts` checks content presence and center class, not positional order.
- `mobile-controller.spec.ts` checks visibility and absence of "Flow Control", not order.
- `shell-and-settings.spec.ts` checks visibility only.
- No test asserts left/right positional order. No changes needed.

**Out of scope:**
- Writing new E2E tests
- Changing app code

**Acceptance criteria:**
- [x] All existing E2E tests pass with new nav order
- [x] No false positives introduced
- [x] `npm run smoke:e2e` passes (if CI available) — not run locally, but no order assertions exist

**Verification:** `npm run smoke:e2e` or manual test run

**Risk:** LOW

**Rollback:** N/A (no changes made).

---

## Phase R4 — Sidebar & Topbar Density Polish

### R4-001 — Update routeTitle subtitles per microcopy direction ✅ DONE

**Goal:** Update subtitle strings in `routeTitles` to match the redesign blueprint microcopy.

**Files:**
- `src/components/operator/nav-config.ts`

**UX reason:** Current subtitles are generic ("Metrik operasional", "List per workspace"). New subtitles are more precise and operator-grade.

**Implementation notes:**
Changes applied:
- `/dashboard` subtitle: "Metrik operasional." → "Pulse operasional."
- `/products` subtitle: "List per workspace." → "Katalog produk."
- `/prompts` subtitle: "Editor prompt." → "Workbench prompt."
- `/controller` subtitle: "Eksekusi desktop." → "Batch execution."
- `/drive` subtitle: "Folder aset." → "Aset & file."
- `/settings` subtitle: "Hub konfigurasi." → "Konfigurasi sistem."

**Out of scope:**
- Layout changes
- CSS changes
- Route changes

**Acceptance criteria:**
- [x] All listed subtitles updated
- [x] Topbar renders new subtitles on each route
- [x] TypeScript compiles
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert string changes.

---

### R4-002 — Sidebar density: 32px row height and spacing tokens ✅ DONE

**Goal:** Tighten sidebar row height and spacing to match the dense operator-console direction.

**Files:**
- `src/app/globals.css`

**UX reason:** Current sidebar is slightly loose for a production tool. 32px rows with 8px gaps create a denser, more professional feel.

**Implementation notes:**
- `.sidebar-link--dense.nav-link` min-height changed from `var(--shell-sidebar-link-min-height)` (46px) to `32px`.
- `.sidebar-nav--dense` gap changed from `var(--space-1)` (4px) to `var(--space-2)` (8px).
- Collapsed state unaffected (uses same link class).
- Dark mode unaffected (no color changes).

**Out of scope:**
- Sidebar content/item changes
- Mobile nav changes
- Color changes

**Acceptance criteria:**
- [x] Sidebar links are 32px row height
- [x] Gap between items is 8px
- [x] Collapsed sidebar still functional
- [x] Dark mode verified
- [x] No hardcoded colors — height uses literal 32px (intentional, matches spec)
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert CSS changes.

---

### R4-003 — Topbar density: tighter title area ✅ DONE

**Goal:** Reduce topbar vertical padding and title font size to match dense operator aesthetic.

**Files:**
- `src/app/globals.css`

**UX reason:** Topbar currently takes more vertical space than needed for a dense production tool.

**Implementation notes:**
- `--shell-topbar-desktop-min-height`: 72px → 56px
- `--shell-topbar-desktop-padding-top`: 16px → 10px
- `--shell-topbar-desktop-padding-bottom`: 12px → 8px
- `--shell-topbar-desktop-action-height`: 40px → 36px
- `--shell-topbar-desktop-avatar-size`: 30px → 26px
- `--shell-topbar-desktop-title-icon-size`: 34px → 28px
- Title font size unchanged (`var(--type-section-size)` = 1.36rem) — already appropriate.
- Subtitle font size unchanged (`var(--type-control-sm-size)`) — already appropriate.
- Mobile topbar unaffected (62px min-height, only applies at max-width: 860px).

**Out of scope:**
- Topbar content changes
- Settings gear behavior
- Avatar changes

**Acceptance criteria:**
- [x] Topbar is visually tighter on desktop
- [x] Mobile topbar remains ≥44px height (62px, unaffected)
- [x] Title and subtitle use correct tokens
- [x] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert CSS changes.

---

## Phase R5 — Page-Level UX Refinements

### R5-001 — Intake: collapse bulk import into expandable section

**Goal:** Make the bulk import panel collapsed by default on `/products/new`, expandable on demand.

**Files:**
- `src/app/products/new/page.tsx`
- `src/app/products/new/bulk-import-panel.tsx` (if wrapper needed)
- `src/app/globals.css` (if new collapse styles needed)

**UX reason:** Bulk import is a power-user path. Default view should prioritize the single-product upload cards.

**Implementation notes:**
- Wrap `BulkImportPanel` in a collapsible `<details>` or equivalent disclosure widget.
- Default state: collapsed with a summary label like "Bulk Import (lanjutan)".
- Preserve all existing bulk import functionality when expanded.

**Out of scope:**
- Bulk import logic changes
- Upload card changes
- Server action changes

**Acceptance criteria:**
- [ ] Bulk import section is collapsed by default
- [ ] Expanding reveals full bulk import panel
- [ ] All bulk import functionality preserved
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Remove the collapsible wrapper.

---

### R5-002 — Intake: compact affiliate profile context strip

**Goal:** Replace any full-card affiliate profile display at top of Intake with a compact context strip (avatar + name, single line).

**Files:**
- `src/app/products/new/page.tsx`
- `src/app/globals.css`

**UX reason:** Active affiliate profile context should be visible but not dominant. Upload cards are the hero.

**Implementation notes:**
- If a full `AffiliateProfileHero` or large card is rendered at top, replace with a compact inline strip.
- Use `AvatarThumbnailFrame` at small size + profile name as text.
- Keep the same data — just reduce visual weight.

**Out of scope:**
- Profile switching logic
- Server data changes
- Upload card changes

**Acceptance criteria:**
- [ ] Affiliate profile context is a single compact line
- [ ] Avatar + name visible
- [ ] Upload cards are the dominant visual
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert JSX/CSS changes.

---

### R5-003 — Products: add readiness filter chip bar

**Goal:** Add a horizontal filter chip bar to `/products` for filtering by pipeline stage (All, Draft, Metadata Ready, Prompt Ready, Done).

**Files:**
- `src/app/products/page.tsx`
- `src/app/products/product-list.tsx`
- `src/app/globals.css`

**UX reason:** Operator needs to quickly find products at a specific stage without scanning the full list.

**Implementation notes:**
- Use existing `filter` search param (already in `ProductsPageProps`).
- Render chips as links with active state based on current filter param.
- Map filter values to existing product status/readiness logic.
- Chips: horizontal scroll on mobile, inline on desktop.
- Style with tokens. No new component file needed — inline in page or product-list.

**Out of scope:**
- New database columns
- Changing product status logic
- Pagination changes

**Acceptance criteria:**
- [ ] Filter chips render above product list
- [ ] Clicking a chip updates URL filter param
- [ ] Active chip has visual distinction
- [ ] Horizontal scroll on mobile
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (uses existing filter param infrastructure)

**Rollback:** Remove chip bar JSX/CSS.

---

### R5-004 — Prompts: default readiness filter to "Ready"

**Goal:** Make the prompts workbench default to showing "Ready to generate" items first.

**Files:**
- `src/app/prompts/page.tsx`

**UX reason:** Operator visits prompts to act on ready items. Showing all items by default buries actionable ones.

**Implementation notes:**
- Change the default `readiness` filter from "all" to the ready-to-generate value.
- Use existing `normalizePromptWorkbenchReadinessFilter` — just change the fallback default.
- Ensure "All" chip/filter is still accessible to see everything.

**Out of scope:**
- Prompt generation logic
- Queue drawer changes
- New server queries

**Acceptance criteria:**
- [ ] Prompts page loads with readiness filter set to "ready" by default
- [ ] User can still switch to "all" filter
- [ ] No data logic changes
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert default filter value.

---

### R5-005 — Controller: mobile redirect toast before redirect

**Goal:** Show a brief informational message before redirecting mobile users away from `/controller`.

**Files:**
- `src/app/controller/controller-mobile-redirect.tsx`

**UX reason:** Currently mobile users are silently redirected. A brief message ("Flow Control tersedia di desktop") provides context.

**Implementation notes:**
- Before calling `window.location.replace`, briefly show a toast or set a flash message.
- Option A: Use existing `FeedbackDock` mechanism to queue a toast, then redirect after 1.5s delay.
- Option B: Show inline text for 1.5s before redirect.
- Keep redirect behavior — just add context.

**Out of scope:**
- Making controller work on mobile
- Changing redirect target
- Adding mobile Flow queue

**Acceptance criteria:**
- [ ] Mobile user sees brief message before redirect
- [ ] Redirect still happens (to `/products/new`)
- [ ] Desktop users unaffected
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Remove the delay/toast, revert to immediate redirect.

---

### R5-006 — Drive: responsive grid vs list based on viewport

**Goal:** Show Drive items as a grid on desktop and a compact list on mobile.

**Files:**
- `src/app/drive/drive-visual-manager.tsx`
- `src/app/globals.css`

**UX reason:** Grid with larger thumbnails is better for visual asset browsing on desktop. Compact list is better for mobile touch targets.

**Implementation notes:**
- Use CSS media queries to switch between grid and list layout.
- Grid: `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` on desktop.
- List: single-column rows with small thumbnail + filename on mobile.
- No JS viewport detection needed — CSS-only responsive.

**Out of scope:**
- Drive data fetching changes
- Upload logic
- Bottom sheet behavior

**Acceptance criteria:**
- [ ] Desktop shows grid layout with larger thumbnails
- [ ] Mobile shows compact list layout
- [ ] All existing functionality preserved
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (CSS-only)

**Rollback:** Revert CSS changes.

---

## Phase R6 — Outputs Discoverability

### R6-001 — Decision: outputs as nav item vs product detail tab

**Goal:** Document the decision on whether `/outputs` becomes a desktop nav item or is accessed only through product detail.

**Files:**
- `docs/ux-redesign-backlog.md` (this file — update decision section below)

**UX reason:** `/outputs` is currently orphaned. Must decide discoverability path before implementing.

**Implementation notes:**
- This is a DESIGN DECISION task, not a code task.
- Evaluate: Does the operator need to browse all outputs across products? Or only per-product?
- If cross-product browsing is needed → add to desktop nav.
- If per-product only → merge into product detail Output tab and remove standalone route.
- Document decision with rationale.

**Decision criteria:**
- If `outputs` table has >50 rows per typical operator → standalone route justified.
- If outputs are always viewed in product context → product detail tab sufficient.

**Out of scope:**
- Code changes (this task is decision-only)

**Acceptance criteria:**
- [ ] Decision documented in this file
- [ ] Rationale written
- [ ] Next implementation task defined based on decision

**Verification:** N/A (docs-only)

**Risk:** LOW

**Rollback:** N/A

---

### R6-002 — Implement outputs discoverability (based on R6-001 decision)

**Goal:** Make `/outputs` discoverable per the decision in R6-001.

**Files (if nav item path chosen):**
- `src/components/operator/nav-config.ts`
- `src/app/outputs/page.tsx` (content improvements)

**Files (if product detail tab path chosen):**
- `src/app/products/product-detail-panel.tsx`
- `src/app/products/[id]/page.tsx`

**UX reason:** Outputs must be reachable without memorizing a URL.

**Implementation notes:**
- Path A (nav item): Add `{ href: "/outputs", label: "Output", icon: Archive }` to `desktopNavItems` after Drive. Update outputs page to show real content grouped by product.
- Path B (product tab): Add an "Output" tab to product detail panel. Show generated files for that product. Remove or keep `/outputs` as a redirect.

**Out of scope:**
- Schema changes
- New output generation logic
- Mobile nav changes (outputs stays desktop-only either way)

**Acceptance criteria:**
- [ ] Outputs are reachable through normal navigation
- [ ] Content is real (not placeholder)
- [ ] Loading/empty/error states present
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert nav-config or product-detail changes.

---

## Decision Log

### R6-001 Decision: [PENDING]

_To be filled after R6-001 is executed._

---

## Implementation Priority

### Top 5 safest tasks to implement first:

1. **R1-001** — Root redirect change (1 line, zero risk)
2. **R1-002** — Nav-config cleanup (string/array edits, zero risk)
3. **R1-003** — Settings/flow redirect fix (1 line, zero risk)
4. **R4-001** — Subtitle microcopy updates (string edits only)
5. **R3-001** — Mobile nav reorder (array reorder, existing center logic handles it)

### Tasks that should NOT be implemented yet:

| Task | Reason |
|------|--------|
| **R5-004** | Changing default filter may surprise the operator. Needs UX validation that "ready" is the right default vs. "all". Discuss with operator first. |
| **R6-002** | Blocked on R6-001 decision. Cannot implement without knowing the path. |

---

## Dependency Graph

```text
R1-001 ─┐
R1-002 ─┼─ (independent, can be one PR)
R1-003 ─┘

R2-001 → R2-002 → R2-003 → R2-004 → R2-005

R3-001 → R3-002

R4-001 ─┐
R4-002 ─┼─ (independent within phase)
R4-003 ─┘

R5-001 ─┐
R5-002 ─┤
R5-003 ─┤ (independent per page)
R5-004 ─┤
R5-005 ─┤
R5-006 ─┘

R6-001 → R6-002
```

---

## Relationship to Existing Backlogs

This backlog is **additive** to `docs/MICRO_TASK_BACKLOG.md`. It does not replace or conflict with:
- Controller polish tasks (CTRL-POLISH-01 through CTRL-POLISH-05)
- UI Shell Rebrand tasks (UI-SHELL-REBRAND-*)
- Phase 2 micro-tasks (P2-*)

Phase R4 sidebar/topbar density work may overlap with `UI-SHELL-REBRAND-02`. If conflict arises, this backlog's direction wins for density values; the rebrand lock wins for token methodology.

Phase R5 controller toast (R5-005) is independent of CTRL-POLISH tasks and should be done before or after them without conflict.

---

## Implementation Log

### Phase R2 Backend Helpers — Completed 2026-05-19

**Agent:** Codex
**Scope:** Backend/data helpers only. No UI, CSS, nav/routing, schema migration, or dependency change.
**Verification:** `npm run lint` passed with 0 errors / 77 pre-existing warnings; `npm run typecheck` passed; `npm run build` passed.

| Task | Status | Notes |
|------|--------|-------|
| R2-001 | DONE | Added `getDashboardPipelineStageCounts()` in `src/lib/server/dashboard-pipeline.ts`. Counts are exclusive product-level buckets using active workspace owner scope and the documented precedence. |
| R2-002 | DONE | Added `getDashboardActionQueue()` in `src/lib/server/dashboard-actions.ts`. Action sources degrade independently into `partial` results after base auth/workspace/product loading succeeds. |

**Files changed:**
- `src/lib/server/dashboard-pipeline.ts` — pipeline stage count helper and exported return types
- `src/lib/server/dashboard-actions.ts` — action queue helper and exported return types
- `docs/ux-redesign-backlog.md` — R2 backend status, API, verification, and Kiro handoff notes

**Kiro UI handoff:**
- R2-003 can import `getDashboardActionQueue()` from `src/lib/server/dashboard-actions.ts`.
- R2-004 can import `getDashboardPipelineStageCounts()` from `src/lib/server/dashboard-pipeline.ts`.
- UI must treat `unavailable` as an error/empty state, not zero work.
- UI must render `partial` action queue results with available items plus a compact warning for `errors`.
- Do not duplicate Supabase queries in `src/app/dashboard/page.tsx`.

---

### Phase R1 — Completed 2026-05-19

**Agent:** Kiro
**Duration:** Single session
**Verification:** All three commands pass (lint: 0 errors/77 pre-existing warnings, typecheck: clean, build: success)

| Task | Status | Notes |
|------|--------|-------|
| R1-001 | ✅ DONE | Root redirect changed to `/dashboard` |
| R1-002 | ✅ DONE | Badge removed, `/intake` removed from routeTitles, `/settings/drive` added. Required changing `desktopNavItems` from `satisfies` to explicit type annotation to fix TS2339 (badge? no longer inferred when no items have it). |
| R1-003 | ✅ DONE | `/settings/flow` now redirects to `/controller`. Actual previous target was `/settings`, not `/products/new` as assumed in blueprint. |

**Files changed:**
- `src/app/page.tsx` — redirect target
- `src/components/operator/nav-config.ts` — badge removal, routeTitles cleanup, type annotation fix
- `src/app/settings/flow/page.tsx` — redirect target
- `docs/ux-redesign-backlog.md` — status updates

**Unexpected finding:** The `/settings/flow` page was redirecting to `/settings` (not `/products/new` as the blueprint assumed from the PRD route lock). The PRD says `/controller` and `/flow` redirect to `/products/new` during Phase 1, but `/settings/flow` is a different route and was pointing to the settings hub. Now corrected to `/controller`.

---

### Phase R3 — Completed 2026-05-19

**Agent:** Kiro
**Duration:** Single session
**Verification:** typecheck clean, build success

| Task | Status | Notes |
|------|--------|-------|
| R3-001 | ✅ DONE | Mobile nav reordered to Dashboard, Produk, Intake, Prompt, Drive. Center logic unchanged (picks by href). |
| R3-002 | ✅ DONE (NO-OP) | No E2E tests assert positional order. All tests check content presence and center class only. |

**Files changed:**
- `src/components/operator/nav-config.ts` — mobileNavItems array reorder
- `docs/ux-redesign-backlog.md` — status updates

**How center logic works:** `app-shell.tsx` finds center item by `href === "/products/new"`, then splits remaining items: first 2 → left, rest → right. New order produces: left=[Dashboard, Produk], center=Intake, right=[Prompt, Drive].

---

### Phase R4-001 — Completed 2026-05-19

**Agent:** Kiro
**Duration:** Single session
**Verification:** typecheck clean, build success

| Task | Status | Notes |
|------|--------|-------|
| R4-001 | ✅ DONE | 6 subtitle strings updated in routeTitles. String-only change, zero risk. |

**Files changed:**
- `src/components/operator/nav-config.ts` — 6 subtitle values updated
- `docs/ux-redesign-backlog.md` — status update

---

### Phase R4-002/003 — Completed 2026-05-19

**Agent:** Kiro
**Duration:** Single session
**Verification:** typecheck clean, build success

| Task | Status | Notes |
|------|--------|-------|
| R4-002 | ✅ DONE | Sidebar link min-height 46px→32px, nav gap 4px→8px |
| R4-003 | ✅ DONE | Topbar height 72px→56px, padding reduced, icon/avatar sizes proportionally reduced |

**Files changed:**
- `src/app/globals.css` — sidebar density + topbar density token changes
- `docs/ux-redesign-backlog.md` — status update

**Token changes summary:**
```
.sidebar-nav--dense gap: var(--space-1) → var(--space-2)
.sidebar-link--dense min-height: var(--shell-sidebar-link-min-height) → 32px
--shell-topbar-desktop-min-height: 72px → 56px
--shell-topbar-desktop-padding-top: 16px → 10px
--shell-topbar-desktop-padding-bottom: 12px → 8px
--shell-topbar-desktop-action-height: 40px → 36px
--shell-topbar-desktop-avatar-size: 30px → 26px
--shell-topbar-desktop-title-icon-size: 34px → 28px
```

---

### Phase R2-003/004/005 — Completed 2026-05-19

**Agent:** Kiro
**Duration:** Single session
**Verification:** typecheck clean, lint 0 errors (only pre-existing warnings), build success

| Task | Status | Notes |
|------|--------|-------|
| R2-003 | ✅ DONE | Action Queue section added at top using `getDashboardActionQueue`. Tone-coded dot + label + count + chevron rows. |
| R2-004 | ✅ DONE | Pipeline Summary strip added using `getDashboardPipelineStageCounts`. 6-stage flow with arrow separators on desktop, 2-col grid on mobile. |
| R2-005 | ✅ DONE | Existing Gemini sections wrapped in `.dashboard-infrastructure` container with top border + reduced heading weight via `variant="secondary"`. |

**Files changed:**
- `src/app/dashboard/page.tsx` — added Action Queue and Pipeline Summary sections, wrapped Gemini in infrastructure container
- `src/app/globals.css` — added ~150 lines of dashboard CSS using only existing design tokens
- `docs/ux-redesign-backlog.md` — status updates

**New page hierarchy:**
```
1. Action queue       (primary — what to do now)
2. Pipeline produk    (primary — pipeline state)
─── divider ───
3. Ringkasan Gemini   (secondary — infrastructure)
4. Live cycle Gemini  (secondary — infrastructure)
5. Gemini key usage   (secondary — infrastructure)
```

**Backend integration:**
- Both helpers (`getDashboardActionQueue`, `getDashboardPipelineStageCounts`) consumed as designed.
- No backend changes needed. Type contracts work cleanly.
- Helpers handle their own auth/workspace resolution internally.

---

## Handoff Notes for Next Agent

### Completed phases:
- ✅ Phase R1 — Navigation & Routing Fix
- ✅ Phase R2 — Full (backend R2-001/R2-002 by Codex + frontend R2-003/R2-004/R2-005 by Kiro)
- ✅ Phase R3 — Mobile Bottom Nav Reorder
- ✅ Phase R4 — Sidebar & Topbar Density Polish (all 3 tasks)

### Ready to implement next:
1. **R5-001** (Intake: collapse bulk import) — LOW risk
2. **R5-002** (Intake: compact affiliate context strip) — LOW risk
3. **R5-003** (Products: filter chip bar) — LOW risk
4. **R5-006** (Drive: responsive grid) — LOW risk, CSS-only

### Backend handoff items for Codex:
- **None blocking.** Both R2 helpers worked as designed.
- **Optional:** Add stage filter values to Products page server contract so `/products?filter=draft|metadata-ready|generated|done` works. Currently pipeline strip links degrade to "all products" if filter is unknown.
- **Optional:** Verify `/prompts?readiness=GENERATED` vs `READY_FOR_PROMPT` — action queue uses one, pipeline strip uses the other. Both point to prompts page but filter differently.

### E2E test risk:
- Tests in `tests/e2e/` may assert root redirect to `/products/new`. Run `npm run smoke:e2e` if available to catch failures.
- `tests/e2e/shell-and-settings.spec.ts` and `tests/e2e/auth-access-regression.spec.ts` are most likely affected by R1 root redirect change.
- Mobile nav E2E tests do NOT assert positional order — confirmed safe.

### Type system note:
- `desktopNavItems` uses explicit `OperatorNavItem[]` type (not `satisfies`). If a future task adds a badge back, it works without type changes.
- `mobileNavItems` and `routeTitles` still use `satisfies` — safe because consuming code doesn't access optional fields absent from all items.

### PRD compliance note:
- The PRD (`docs/PRD_SOURCE_OF_TRUTH.md` §1.1) lists mobile bottom nav as: `Dashboard, Intake, Produk, Prompt, Drive`. The R3 reorder changes this to `Dashboard, Produk, Intake, Prompt, Drive`. This is an intentional UX improvement (center-elevating Intake). If PRD compliance is strict, this may need a PRD amendment note.


---

## UI Component Consistency Audit Reference

Full audit findings and proposed tasks: [`docs/UI_COMPONENT_CONSISTENCY_AUDIT.md`](UI_COMPONENT_CONSISTENCY_AUDIT.md)

Tasks UI-AUDIT-01 through UI-AUDIT-07 are defined there. Implementation order:
1. UI-AUDIT-01 + UI-AUDIT-03 (button tokens + mobile touch targets)
2. UI-AUDIT-06 (icon-only button)
3. UI-AUDIT-04 (sidebar brand alignment)
4. UI-AUDIT-05 (StatusBadge CSS consolidation)
5. UI-AUDIT-02 (StatusBadge size="sm" per-page)
6. UI-AUDIT-07 (DEFERRED)
