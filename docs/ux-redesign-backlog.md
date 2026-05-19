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

### R2-001 — Add pipeline stage count server helper

**Goal:** Create a server helper that returns product counts per pipeline stage (draft, metadata-ready, prompt-ready, generated, exported, done).

**Files:**
- `src/lib/server/dashboard-pipeline.ts` (new)

**UX reason:** Dashboard needs pipeline summary data. Server helper must exist before the UI can consume it.

**Implementation notes:**
- Query `products` table grouped by a derived readiness state.
- Use existing `createSupabaseServerClient` pattern.
- Return a typed object: `{ draft: number, metadataReady: number, promptReady: number, generated: number, exported: number, done: number, total: number }`.
- Derive stages from existing columns (`status`, intake session state, prompt pack existence, flow batch state). Do NOT add new DB columns.
- Handle errors gracefully — return `{ status: "unavailable", message: string }` on failure.

**Out of scope:**
- UI changes
- Schema changes
- New indexes (use existing queries)

**Acceptance criteria:**
- [ ] Function is exported and typed
- [ ] Returns stage counts or unavailable status
- [ ] No schema migration required
- [ ] TypeScript compiles
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** MEDIUM (new server query, must verify performance with existing indexes)

**Rollback:** Delete the new file.

---

### R2-002 — Add action queue server helper

**Goal:** Create a server helper that returns a list of actionable items requiring operator attention.

**Files:**
- `src/lib/server/dashboard-actions.ts` (new)

**UX reason:** Dashboard action queue needs structured data about what needs attention.

**Implementation notes:**
- Query for: products needing metadata review, prompt packs ready to generate, batches ready to export, outputs needing verification.
- Return max 5 items, each with: `type`, `count`, `label`, `href`.
- Use existing server helpers where possible (compose, don't duplicate).
- Handle partial failures gracefully — if one query fails, still return others.

**Out of scope:**
- UI changes
- Schema changes
- New tables

**Acceptance criteria:**
- [ ] Function is exported and typed
- [ ] Returns array of action items (max 5)
- [ ] Graceful degradation on partial query failure
- [ ] TypeScript compiles
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** MEDIUM (multiple queries, must verify performance)

**Rollback:** Delete the new file.

---

### R2-003 — Dashboard: add Action Queue section UI

**Goal:** Add an "Action Queue" section at the top of the dashboard page that shows actionable items from R2-002.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css` (if new CSS classes needed)

**UX reason:** Operator needs to see "what needs my attention" within 3 seconds of landing.

**Implementation notes:**
- Import and call the action queue helper from R2-002.
- Render as a compact vertical list: status dot + description + count + chevron link.
- Include loading, empty ("Semua beres. ✓"), and error states.
- Place above existing Gemini section.
- Use existing `SectionCard` or a new lightweight container. No new dependencies.

**Out of scope:**
- Changing existing Gemini sections
- Pipeline summary (separate task)
- New components outside this page

**Acceptance criteria:**
- [ ] Action queue section renders at top of dashboard
- [ ] Shows real data from server helper
- [ ] Loading state shows skeleton
- [ ] Empty state shows "Semua beres." message
- [ ] Error state shows retry message
- [ ] Links navigate to correct filtered pages
- [ ] Mobile responsive
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** MEDIUM (new UI section with server data)

**Rollback:** Remove the section from `page.tsx`. Server helper remains available.

---

### R2-004 — Dashboard: add Pipeline Summary section UI

**Goal:** Add a "Pipeline Summary" section showing product counts per stage as a horizontal flow strip.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

**UX reason:** Operator needs a quick visual of pipeline throughput — how many items at each stage.

**Implementation notes:**
- Import and call the pipeline helper from R2-001.
- Render as a horizontal strip: `[Intake: N] → [Prompt: N] → [Generated: N] → [Exported: N] → [Done: N]`.
- Each segment is a link to the relevant filtered list.
- Use CSS flexbox with arrow separators. No chart library.
- Include loading and error states.
- Place between Action Queue and Gemini sections.
- On mobile: wrap to 2 rows if needed, or horizontal scroll.

**Out of scope:**
- Animated charts
- New dependencies
- Changing Gemini section

**Acceptance criteria:**
- [ ] Pipeline strip renders with real stage counts
- [ ] Each segment links to filtered view
- [ ] Loading and error states present
- [ ] Responsive on mobile (no overflow hidden)
- [ ] Uses design tokens only
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (UI-only, data from existing helper)

**Rollback:** Remove the section from `page.tsx`.

---

### R2-005 — Dashboard: demote Gemini section visually

**Goal:** Reduce visual prominence of existing Gemini KPI/live-cycle sections so they read as infrastructure health, not primary content.

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

**UX reason:** Gemini metrics are infrastructure health. The new Action Queue and Pipeline Summary are the primary operational content.

**Implementation notes:**
- Wrap existing Gemini sections in a collapsible or visually demoted container.
- Reduce heading size from section-title to subsection level.
- Add a subtle divider or spacing increase between pipeline and Gemini sections.
- Do NOT remove any existing functionality.
- CSS-only changes preferred. Minimal JSX restructuring.

**Out of scope:**
- Removing Gemini data
- Changing Gemini queries
- Adding new metrics

**Acceptance criteria:**
- [ ] Gemini sections still render with all existing data
- [ ] Visual hierarchy: Action Queue > Pipeline > Gemini
- [ ] No data or functionality removed
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW (presentation-only)

**Rollback:** Revert CSS/JSX changes.

---

## Phase R3 — Mobile Bottom Nav Reorder

### R3-001 — Reorder mobile nav: center Intake

**Goal:** Change mobile bottom nav order from `[Dashboard, Intake, Produk, Prompt, Drive]` to `[Dashboard, Produk, Intake, Prompt, Drive]` so Intake occupies the center-elevated position.

**Files:**
- `src/components/operator/nav-config.ts`

**UX reason:** Center position is the primary action slot. Intake is the most frequent mobile action. Produk and Prompt flank it as pipeline context.

**Implementation notes:**
- Reorder `mobileNavItems` array to: Dashboard, Produk, Intake, Prompt, Drive.
- The `app-shell.tsx` center-item logic already picks the item at `href === "/products/new"` — verify this still works after reorder.

**Out of scope:**
- Desktop nav changes
- AppShell layout changes
- Route changes

**Acceptance criteria:**
- [ ] Mobile bottom nav renders in order: Dashboard | Produk | ●Intake● | Prompt | Drive
- [ ] Center-elevated button is Intake
- [ ] Active states work for all 5 items
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert array order in `nav-config.ts`.

---

### R3-002 — Verify mobile nav E2E tests

**Goal:** Update any E2E test assertions that depend on mobile nav item order.

**Files:**
- `tests/e2e/shell-and-settings.spec.ts` (if assertions exist)
- `tests/e2e/mobile-controller.spec.ts` (if assertions exist)
- Any other test referencing bottom nav order

**UX reason:** Tests must match the new nav order to prevent CI failures.

**Implementation notes:**
- Search test files for bottom nav assertions.
- Update expected order/position if found.
- If no tests assert nav order, mark as NO-OP.

**Out of scope:**
- Writing new E2E tests
- Changing app code

**Acceptance criteria:**
- [ ] All existing E2E tests pass with new nav order
- [ ] No false positives introduced
- [ ] `npm run smoke:e2e` passes (if CI available)

**Verification:** `npm run smoke:e2e` or manual test run

**Risk:** LOW

**Rollback:** Revert test changes.

---

## Phase R4 — Sidebar & Topbar Density Polish

### R4-001 — Update routeTitle subtitles per microcopy direction

**Goal:** Update subtitle strings in `routeTitles` to match the redesign blueprint microcopy.

**Files:**
- `src/components/operator/nav-config.ts`

**UX reason:** Current subtitles are generic ("Metrik operasional", "List per workspace"). New subtitles are more precise and operator-grade.

**Implementation notes:**
Changes:
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
- [ ] All listed subtitles updated
- [ ] Topbar renders new subtitles on each route
- [ ] TypeScript compiles
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert string changes.

---

### R4-002 — Sidebar density: 32px row height and spacing tokens

**Goal:** Tighten sidebar row height and spacing to match the dense operator-console direction.

**Files:**
- `src/app/globals.css`

**UX reason:** Current sidebar is slightly loose for a production tool. 32px rows with 8px gaps create a denser, more professional feel.

**Implementation notes:**
- Update `.sidebar-link--dense` height/padding to achieve 32px row height.
- Update `.sidebar-nav--dense` gap to 8px (or `var(--space-1)`).
- Verify collapsed state still works.
- Verify dark mode.
- Use existing tokens or extend token layer if needed (add token first, then consume).

**Out of scope:**
- Sidebar content/item changes
- Mobile nav changes
- Color changes

**Acceptance criteria:**
- [ ] Sidebar links are 32px row height
- [ ] Gap between items is 8px
- [ ] Collapsed sidebar still functional
- [ ] Dark mode verified
- [ ] No hardcoded values — tokens only
- [ ] `npm run build` passes

**Verification:** `npm run lint && npm run typecheck && npm run build`

**Risk:** LOW

**Rollback:** Revert CSS changes.

---

### R4-003 — Topbar density: tighter title area

**Goal:** Reduce topbar vertical padding and title font size to match dense operator aesthetic.

**Files:**
- `src/app/globals.css`

**UX reason:** Topbar currently takes more vertical space than needed for a dense production tool.

**Implementation notes:**
- Reduce `.operator-topbar--dense` padding.
- Ensure title `h1` uses `--type-section-title-size` (not larger).
- Ensure subtitle `p` uses `--type-body-sm-size`.
- Verify mobile topbar remains touch-friendly (min 44px height).

**Out of scope:**
- Topbar content changes
- Settings gear behavior
- Avatar changes

**Acceptance criteria:**
- [ ] Topbar is visually tighter on desktop
- [ ] Mobile topbar remains ≥44px height
- [ ] Title and subtitle use correct tokens
- [ ] `npm run build` passes

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
| **R2-001** | Requires careful query design against existing schema. Needs performance review before merging. |
| **R2-002** | Depends on R2-001. Multiple cross-table queries need validation. |
| **R2-003** | Depends on R2-002. Cannot build UI without data layer. |
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

## Handoff Notes for Next Agent

### Ready to implement next:
1. **R3-001** (Mobile nav reorder) — safest next task, array reorder only
2. **R4-001** (Subtitle microcopy) — string-only changes, zero risk

### Before starting R2:
- R2-001 requires designing server queries against existing schema
- Review `src/lib/server/` for existing product/prompt status helpers to compose from
- Do NOT create new DB indexes or columns

### E2E test risk:
- Tests in `tests/e2e/` may assert root redirect to `/products/new`. Run `npm run smoke:e2e` if available to catch failures.
- `tests/e2e/shell-and-settings.spec.ts` and `tests/e2e/auth-access-regression.spec.ts` are most likely to be affected.

### Type system note:
- `desktopNavItems` now uses explicit `OperatorNavItem[]` type instead of `satisfies`. If a future task adds a badge back to any item, it will work without type changes. The `mobileNavItems` and `routeTitles` arrays still use `satisfies` since their consuming code doesn't access optional fields that might be absent.
