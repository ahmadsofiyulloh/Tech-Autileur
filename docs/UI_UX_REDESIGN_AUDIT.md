# UI/UX Redesign Audit

## 1. Executive Summary

**Current UI maturity:** medium. The repo already has a working Next.js App Router PWA shell, mobile bottom nav, desktop sidebar, semantic tokens, loading states, several empty states, drawers, bottom sheets, and route-level UI. It is not a blank slate.

**Biggest risks:**

- PRD route/nav drift exists:
  - `src/app/page.tsx` redirects `/` to `/dashboard`, but PRD locks `/ -> /products/new`.
  - `src/components/operator/nav-config.ts` exposes `Flow Control` in desktop nav.
  - Mobile nav order is `Dashboard, Produk, Intake, Prompt, Drive`, but PRD locks `Dashboard, Intake, Produk, Prompt, Drive`.
  - `src/app/controller/page.tsx` still renders a desktop placeholder instead of redirecting.
- The visual system is centralized but overgrown in `src/app/globals.css`.
- Desktop views often feel like widened mobile cards, especially `/dashboard`, `/settings`, and `/prompts`.
- Component duplication is high around toolbars, search, filters, list cards, metric cards, drawers, and settings manager tables.
- Some copy is English or verbose despite PRD copy constraints.
- Design token audits pass, but manual inspection found hardcoded CSS values that current audit scripts miss.

**Recommended refactor order:**

1. Fix PRD route/nav compliance first.
2. Normalize token/audit enforcement before broad visual work.
3. Build small shared operator primitives.
4. Redesign one route family at a time.
5. Finish with responsive screenshot QA across all required viewport bands.

## 2. Repo Map

### Framework And Routing

- Framework: Next.js App Router
- Language: TypeScript
- App root: `src/app`
- Global layout: `src/app/layout.tsx`
- Shell component: `src/components/app-shell.tsx`
- Navigation config: `src/components/operator/nav-config.ts`
- Global styles/tokens: `src/app/globals.css`

### Route Files Audited

- `/`: `src/app/page.tsx`
- `/dashboard`: `src/app/dashboard/page.tsx`
- `/products`: `src/app/products/page.tsx`
- `/products/new`: `src/app/products/new/page.tsx`
- `/products/[id]`: `src/app/products/[id]/page.tsx`
- `/prompts`: `src/app/prompts/page.tsx`
- `/prompts/[id]`: `src/app/prompts/[id]/page.tsx`
- `/prompts/[id]/history`: `src/app/prompts/[id]/history/page.tsx`
- `/drive`: `src/app/drive/page.tsx`
- `/settings`: `src/app/settings/page.tsx`
- `/settings/workspace`: `src/app/settings/workspace/page.tsx`
- `/settings/affiliate-profiles`: `src/app/settings/affiliate-profiles/page.tsx`
- `/settings/gemini`: `src/app/settings/gemini/page.tsx`
- `/settings/account`: `src/app/settings/account/page.tsx`
- `/settings/drive`: `src/app/settings/drive/page.tsx`
- `/controller`: `src/app/controller/page.tsx`
- `/flow`: `src/app/flow/page.tsx`
- `/intake`: `src/app/intake/page.tsx`
- `/outputs`: `src/app/outputs/page.tsx`
- `/gemini`: `src/app/gemini/page.tsx`

### Key UI Directories

- `src/components/operator`
- `src/components/ui`
- `src/components/app-shell.tsx`
- Route-local client components under:
  - `src/app/products`
  - `src/app/products/new`
  - `src/app/prompts`
  - `src/app/drive`
  - `src/app/settings`

### Styling And Theme Files

- `src/app/globals.css`
- `scripts/audit-color-tokens.mjs`
- `scripts/audit-typography-tokens.mjs`

The repo uses semantic CSS variables heavily, but `globals.css` has become the main design system, route stylesheet, responsive stylesheet, and compatibility layer all at once.

### Shared Components Already Present

- App shell: `src/components/app-shell.tsx`
- Status badge: `src/components/operator/status-badge.tsx`
- Empty state: `src/components/operator/empty-state.tsx`
- Loading skeleton: `src/components/operator/loading-skeleton.tsx`
- Section card: `src/components/operator/section-card.tsx`
- Bottom sheet: `src/components/operator/bottom-sheet.tsx`
- Detail drawer: `src/components/operator/detail-drawer.tsx`
- Copy field: `src/components/operator/copyable-readonly-field.tsx`
- Upload card: `src/components/operator/image-preview-upload-card.tsx`
- Buttons/menus:
  - `src/components/ui/native-button.tsx`
  - `src/components/ui/overflow-action-menu.tsx`
  - `src/components/ui/delete-action-button.tsx`

## 3. PRD Compliance Findings

### Compliant Areas

- `src/app/flow/page.tsx` redirects `/flow` to `/products/new`.
- `src/app/intake/page.tsx` redirects `/intake` to `/products/new`.
- `src/app/gemini/page.tsx` redirects `/gemini` to `/settings/gemini`.
- `src/app/settings/drive/page.tsx` redirects `/settings/drive` to `/settings`.
- Core Phase 1 route files exist.
- `/products/new` centers Intake and metadata analysis.
- `/drive` is a browser/preview surface, not a full asset editor.
- Mobile Controller access redirects to `/products/new`.
- Large asset handling appears Drive-centered in UI.
- Loading routes exist for most major surfaces.

### Violations

- `src/app/page.tsx` redirects `/` to `/dashboard`; PRD locks `/ -> /products/new`.
- `src/components/operator/nav-config.ts` desktop nav includes `Flow Control`; PRD says Controller/Flow are dormant/frozen and must not be primary workflow nav.
- `src/components/operator/nav-config.ts` mobile nav order does not match locked PRD order.
- `src/app/controller/page.tsx` renders a desktop placeholder instead of redirecting `/controller -> /products/new`.
- `/products/[id]` exists only as a redirect into `/products?detail=...`; PRD describes a product detail route with Metadata, Output, and History.
- `/prompts/[id]` exists only as a redirect into `/prompts?detail=...`; PRD describes a prompt detail/editor route.
- `src/app/settings/gemini/gemini-settings-board.tsx` exposes delete-oriented UI labels around Gemini keys; PRD action language emphasizes `Gemini baru`, `Kelola`, `Simpan`, and `Disable`.
- Mixed English copy appears in operational UI, especially errors, settings groups, placeholder states, and Controller copy.

### Unclear Areas

- The user referenced `PRD_SOURCE_OF_TRUTH(1).md`; the actual repo file inspected is `docs/PRD_SOURCE_OF_TRUTH.md`.
- `docs/ux-redesign-backlog.md` records prior completed UI decisions that now conflict with the current PRD, especially root redirect and mobile nav order.
- `ACCEPTANCE_CRITERIA.md` mentions Inter, but `src/app/layout.tsx` imports Geist. This needs a product/design decision before changing fonts.

### Missing Or Partial States

- Shared loading exists, but not all loading states feel route-specific.
- Shared empty state exists, but several screens use local muted boxes instead.
- No shared `ErrorState` component equivalent was found.
- Prompt history and nested settings sections rely partly on parent or inline error handling rather than consistent route-local error components.

## 4. Responsive Audit

| Route | Mobile 360-767 | Tablet 768-1023 | Desktop 1024-1279 | Wide 1280+ | Key issue | Recommended fix |
|---|---|---|---|---|---|---|
| `/` | N/A | N/A | N/A | N/A | Redirect target violates PRD | Redirect to `/products/new` |
| `/dashboard` | Acceptable | Mobile-like until breakpoint | Too narrow | Too narrow | Looks like enlarged mobile summary | Create desktop command-center grid with compact metrics and work queue |
| `/products/new` | Strong | 768-860 still mobile | Good but dense | Side panel underused | Bulk import and intake compete | Preserve intake priority; make desktop side panel more compact |
| `/products` | Good cards | Tablet cards | Good table/list | Needs denser use of width | Detail route is query-param drawer | Keep cards mobile, add denser desktop list/table and PRD route decision |
| `/products/[id]` | Redirect only | Redirect only | Redirect only | Redirect only | PRD route not actually rendered | Restore standalone route or document approved exception |
| `/prompts` | Acceptable | Card-heavy | Card-heavy | Too much vertical card scanning | Desktop not data-first | Convert desktop to compact workbench with shared toolbar/filter primitives |
| `/prompts/[id]` | Redirect only | Redirect only | Redirect only | Redirect only | PRD route not actually rendered | Restore standalone prompt detail route or document approved exception |
| `/prompts/[id]/history` | Acceptable | Acceptable | Narrow | Narrow | Simple list surface | Give desktop a compact two-column history/detail affordance only if needed |
| `/drive` | Good sheets | Mobile treatment until 861 | Good | Preview drawer too equal-weight | Tablet gap and drawer proportions | Add tablet layout and tune desktop preview ratio |
| `/settings` | Good native list | Mobile-like | Phone-list feel | Underuses space | Desktop lacks hub layout | Use desktop settings hub grid while preserving mobile list |
| `/settings/workspace` | Acceptable | Acceptable | Table/drawer works | Wide okay | Workspace can drift into non-goal planning | Visual-only cleanup; avoid expanding concept |
| `/settings/affiliate-profiles` | Acceptable | Acceptable | Table/drawer works | Wide okay | Custom board duplicated | Refactor carefully into shared settings manager pattern |
| `/settings/gemini` | Acceptable | Acceptable | Table/drawer works | Wide okay | Delete/label risk | Align actions to PRD, avoid destructive copy expansion |
| `/settings/account` | Acceptable | Acceptable | Narrow | Narrow | Secret/token-adjacent surface | Avoid unless explicitly needed |
| `/controller` | Redirects on mobile | Placeholder on desktop | Placeholder | Placeholder | PRD dormant route violation | Redirect all viewports to `/products/new` unless PRD changes |
| `/flow` | Redirect | Redirect | Redirect | Redirect | Compliant | No visual work |
| `/intake` | Redirect | Redirect | Redirect | Redirect | Compliant | No visual work |
| `/outputs` | Basic archive | Basic archive | Basic archive | Basic archive | Compatibility only | Keep low priority, do not promote to primary nav |
| `/gemini` | Redirect | Redirect | Redirect | Redirect | Compliant | No visual work |

## 5. Vercel-Inspired Design Gap

### Typography

- Tokenized typography exists, but hardcoded typography remains in `src/app/globals.css` and Recharts config.
- Some route headings and helper text still feel explanatory instead of operator-first.
- Geist is used globally; Inter is referenced elsewhere in repo docs, creating ambiguity.

### Spacing

- Good token coverage exists.
- Some pages still use stacked cards with generous spacing, especially dashboard/settings/prompts.
- Desktop density should increase without making mobile cramped.

### Borders

- Border-driven styling exists and is close to the target.
- Some older shadows, gradients, and elevated card treatments remain.
- A Vercel-like pass should reduce decorative depth and rely more on hairline borders, compact cells, and clear hierarchy.

### Surface Hierarchy

- Too many surfaces have equal visual weight.
- `SectionCard` is useful but overused as the main composition unit.
- Dashboard, prompts, and settings need stronger primary/secondary surface ranking.

### Density

- Mobile density is generally acceptable.
- Desktop needs denser tables, rows, split panes, and persistent side panels.

### Status Badges

- `src/components/operator/status-badge.tsx` exists.
- Badge usage is not fully unified across products, prompts, dashboard, Drive, and settings.

### Tables And Lists

- Product/settings boards have responsive table/card handling.
- Prompt workbench is still too card-heavy on desktop.
- Search/filter/action toolbar patterns are duplicated.

### Drawers And Sheets

- `OperatorDetailDrawer` and `OperatorBottomSheet` exist.
- Custom drawers remain in products/settings/drive.
- Bottom sheet treatment is good on mobile but should be standardized further for detail actions.

### Empty, Loading, Error States

- `EmptyState` and `LoadingSkeleton` exist.
- No shared `ErrorState` was found.
- Error/loading copy is inconsistent and often English.

### Navigation Polish

- Shell is functional.
- Nav must be corrected to PRD locks before visual polish.
- Desktop sidebar should become quieter and more compact after Flow Control is removed.

## 6. Component Refactor Opportunities

| Current duplicated pattern | Existing files | Proposed shared component |
|---|---|---|
| Search inputs | `src/app/products/product-list.tsx`, `src/app/prompts/prompt-workbench-list.tsx`, `src/app/drive/drive-visual-manager.tsx`, settings boards | `src/components/operator/search-input.tsx` |
| Filter chips/tabs | Product filters, prompt filters, Drive filters | `src/components/operator/filter-chips.tsx` |
| Action toolbar | `surface-toolbar`, `settings-list-toolbar`, product/prompt/drive local toolbars | `src/components/operator/action-toolbar.tsx` |
| Metric cards | Dashboard metrics, prompt queue metrics, bulk import summaries | `src/components/operator/metric-card.tsx` |
| Entity cards | Product cards, prompt cards, visual list cards, settings list cards | `src/components/operator/entity-card.tsx` |
| Data list/table shell | Products, settings boards, Drive list mode | `src/components/operator/data-list.tsx` |
| Error panels | Route error files and inline failures | `src/components/operator/error-state.tsx` |
| Detail drawer variants | Product drawer, settings drawer, Drive drawer | Extend `src/components/operator/detail-drawer.tsx` |
| Preview tiles | Drive tile, media thumbnail frame, upload preview | `src/components/operator/preview-tile.tsx` |
| Copy-ready fields | Prompt fields, copyable readonly field | Standardize around `CopyableReadOnlyField` |

## 7. Risk Map

### Safe To Refactor Visually

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/dashboard/error.tsx`
- `src/app/products/product-list.tsx`
- `src/app/prompts/prompt-workbench-list.tsx`
- `src/app/drive/drive-visual-manager.tsx`
- `src/app/settings/page.tsx`
- `src/components/operator/empty-state.tsx`
- `src/components/operator/loading-skeleton.tsx`
- `src/components/operator/section-card.tsx`
- New presentational components under `src/components/operator`

### Should Refactor Carefully

- `src/app/globals.css`
- `src/components/app-shell.tsx`
- `src/components/operator/nav-config.ts`
- `src/components/operator/status-badge.tsx`
- `src/components/operator/detail-drawer.tsx`
- `src/components/operator/bottom-sheet.tsx`
- `src/app/products/product-detail-panel.tsx`
- `src/app/products/product-output-fields.tsx`
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-output-fields.tsx`
- `src/app/settings/affiliate-profiles/affiliate-profile-board.tsx`
- `src/app/settings/gemini/gemini-settings-board.tsx`
- `src/app/settings/workspace/workspace-support-board.tsx`

### Avoid Touching Unless Explicitly Needed

- `supabase/migrations/**`
- `src/app/api/**`
- `src/lib/server/**`
- `src/lib/supabase/**`
- `src/app/**/actions.ts`
- `src/app/controller/actions.ts`
- `src/lib/server/controller.ts`
- `src/lib/server/flow-*`
- `src/app/settings/account/page.tsx`
- `next.config.mjs`
- `proxy.ts`
- `.env*`
- Vercel or production configuration

## 8. Validation Commands

Discovered from `package.json` and README:

- Install: `npm ci`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- E2E smoke test: `npm run smoke:e2e`
- E2E headed: `npm run smoke:e2e:headed`
- E2E report: `npm run smoke:e2e:report`
- Color token audit: `npm run audit:colors`
- Typography token audit: `npm run audit:typography`
- Supabase target check: `npm run supabase:targets`

Additional database commands from repo instructions:

- `supabase db lint`
- `supabase db diff`

Audit commands run during this review:

- `npm run audit:colors`: passed
- `npm run audit:typography`: passed

Not run because this was a no-change audit task:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:e2e`

## 9. Micro-Task Backlog

### UI-001 - Write Audit Handoff Document

**Goal:** Save this audit as the official handoff doc.

**Files likely involved:**

- `docs/UI_UX_REDESIGN_AUDIT.md`

**Constraints:**

- Docs-only.
- No app code changes.

**Acceptance criteria:**

- Audit exists in docs.
- It references actual repo files.
- It clearly states PRD compliance risks.

**Validation commands:**

- None required.

**Screenshot requirements:**

- None.

**PR size limit:** 1 file.

**Dependencies:** none.

### UI-002 - Restore PRD Route And Nav Locks

**Goal:** Align root redirect, nav order, and dormant Controller/Flow behavior with the PRD.

**Files likely involved:**

- `src/app/page.tsx`
- `src/app/controller/page.tsx`
- `src/components/operator/nav-config.ts`

**Constraints:**

- Do not redesign Controller.
- Do not delete dormant Controller code unless explicitly approved.
- Do not introduce Flow as primary UI.
- Preserve locked Indonesian labels.

**Acceptance criteria:**

- `/` redirects to `/products/new`.
- Mobile nav order is `Dashboard`, `Intake`, `Produk`, `Prompt`, `Drive`.
- Desktop workflow nav does not expose `Flow Control`.
- `/controller` redirects to `/products/new` on all viewport classes unless PRD is changed.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- Mobile 390px shell nav.
- Desktop 1280px shell sidebar.

**PR size limit:** 3 files, under 150 changed lines.

**Dependencies:** UI-001 recommended, not required.

### UI-003 - Fix Design Token Audit Coverage

**Goal:** Make token enforcement match the repo's actual CSS patterns.

**Files likely involved:**

- `scripts/audit-color-tokens.mjs`
- `scripts/audit-typography-tokens.mjs`
- `src/app/globals.css`
- `src/components/operator/gemini-live-cycle-chart.tsx`

**Constraints:**

- No broad visual redesign.
- Only remove hardcoded colors/type values or improve audit detection.
- Keep chart behavior unchanged.

**Acceptance criteria:**

- Hardcoded `.ui-card` colors/type values in `src/app/globals.css` are tokenized.
- Recharts tick typography is token-compliant or moved into CSS.
- Audit scripts catch same-line declarations.
- `npm run audit:colors` and `npm run audit:typography` pass for real.

**Validation commands:**

- `npm run audit:colors`
- `npm run audit:typography`
- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- Dashboard chart at desktop 1280px.

**PR size limit:** 4 files, under 250 changed lines.

**Dependencies:** UI-002 preferred.

### UI-004 - Create Shared Operator Toolbar Primitives

**Goal:** Introduce shared compact components for search, filters, and route action bars.

**Files likely involved:**

- `src/components/operator/search-input.tsx`
- `src/components/operator/filter-chips.tsx`
- `src/components/operator/action-toolbar.tsx`
- One pilot route, preferably `src/app/products/product-list.tsx`

**Constraints:**

- Pilot one route only.
- No copy changes except labels already present.
- No behavioral changes.

**Acceptance criteria:**

- Product list uses shared search/filter/toolbar primitives.
- Mobile layout remains stacked and usable.
- Desktop layout is compact and border-driven.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- `/products` at 390px, 768px, 1280px.

**PR size limit:** 4 files, under 300 changed lines.

**Dependencies:** UI-003.

### UI-005 - Add Shared ErrorState

**Goal:** Standardize route and inline error displays.

**Files likely involved:**

- `src/components/operator/error-state.tsx`
- `src/app/dashboard/error.tsx`
- `src/app/products/error.tsx`
- `src/app/prompts/error.tsx`
- `src/app/drive/error.tsx`

**Constraints:**

- Keep copy concise.
- Avoid verbose helper copy.
- Preserve Indonesian operational tone.

**Acceptance criteria:**

- Shared `ErrorState` exists.
- At least four major route error files use it.
- Retry action remains available where currently available.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- One forced route error screenshot if easy through local dev/test harness; otherwise document manual check.

**PR size limit:** 5 files, under 220 changed lines.

**Dependencies:** UI-003.

### UI-006 - Dashboard Desktop Command Center

**Goal:** Redesign `/dashboard` into a compact operator overview that does not look like enlarged mobile.

**Files likely involved:**

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/globals.css`

**Constraints:**

- No new metrics beyond existing data.
- No marketing copy.
- Preserve dashboard as monitoring, not primary workflow replacement.

**Acceptance criteria:**

- Mobile remains readable.
- Desktop uses a clear grid with metrics, queue, and activity surfaces.
- Wide desktop uses available width without stretching cards awkwardly.
- Empty/loading/error states still present.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/dashboard` at 360px, 768px, 1024px, 1280px.

**PR size limit:** 3 files, under 350 changed lines.

**Dependencies:** UI-003, preferably UI-005.

### UI-007 - Intake Desktop Hierarchy Pass

**Goal:** Improve `/products/new` desktop layout while keeping Intake as the primary Phase 1 workflow.

**Files likely involved:**

- `src/app/products/new/page.tsx`
- `src/app/products/new/intake-workflow-form.tsx`
- `src/app/products/new/bulk-import-panel.tsx`
- `src/app/globals.css`

**Constraints:**

- Do not add affiliate carousel/profile switching.
- Preserve `Simpan Produk` and `Analisis Metadata` separation.
- Keep mock/live lifecycle rules intact.
- Do not change server actions.

**Acceptance criteria:**

- Mobile remains first-class.
- Desktop has clearer primary intake column and secondary batch/import area.
- Tablet does not feel like a broken breakpoint.
- Loading/empty/error states remain.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/products/new` at 360px, 768px, 1024px, 1280px.

**PR size limit:** 4 files, under 400 changed lines.

**Dependencies:** UI-003.

### UI-008 - Products List And Detail Polish

**Goal:** Make `/products` more data-first and consistent.

**Files likely involved:**

- `src/app/products/product-list.tsx`
- `src/app/products/product-detail-panel.tsx`
- `src/app/products/product-metadata-sheet.tsx`
- `src/app/globals.css`

**Constraints:**

- Do not alter product lifecycle rules.
- Do not change database schema.
- No new product statuses.

**Acceptance criteria:**

- Product empty states use shared pattern.
- Desktop list/table is compact and scannable.
- Mobile cards remain action-friendly.
- Detail panel keeps Metadata, Output, and History affordances.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/products` at 390px, 768px, 1280px.
- Product detail open at mobile and desktop.

**PR size limit:** 4 files, under 400 changed lines.

**Dependencies:** UI-004.

### UI-009 - Product Detail Route Compliance

**Goal:** Resolve `/products/[id]` PRD mismatch.

**Files likely involved:**

- `src/app/products/[id]/page.tsx`
- `src/app/products/[id]/loading.tsx`
- `src/app/products/[id]/error.tsx`
- Existing product detail components as needed

**Constraints:**

- No schema changes.
- Prefer reusing existing detail panel/data access.
- Do not remove query-param drawer behavior unless approved.

**Acceptance criteria:**

- Direct `/products/[id]` renders a product detail surface or an approved PRD exception is documented.
- Metadata, Output, and History are reachable.
- Mobile and desktop layouts are usable.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/products/[id]` mobile and desktop with real or seeded data if available.

**PR size limit:** 3 files, under 300 changed lines.

**Dependencies:** UI-008.

### UI-010 - Prompt Workbench Desktop Density

**Goal:** Redesign `/prompts` desktop into a compact prompt workstation.

**Files likely involved:**

- `src/app/prompts/prompt-workbench-list.tsx`
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-queue-drawer.tsx`
- `src/app/globals.css`

**Constraints:**

- Preserve Prompt Clip 1 and Prompt Clip 2.
- Preserve prompt generation lifecycle.
- Do not introduce Google Flow batch UI.

**Acceptance criteria:**

- Desktop has compact rows or split-pane scanning.
- Mobile keeps card/bottom-sheet treatment.
- Copy-ready fields remain clear.
- Empty/loading/error states remain.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/prompts` at 360px, 768px, 1024px, 1280px.
- Prompt detail open on mobile and desktop.

**PR size limit:** 4 files, under 450 changed lines.

**Dependencies:** UI-004, UI-005.

### UI-011 - Prompt Detail Route Compliance

**Goal:** Resolve `/prompts/[id]` PRD mismatch.

**Files likely involved:**

- `src/app/prompts/[id]/page.tsx`
- `src/app/prompts/[id]/loading.tsx`
- Existing prompt detail components

**Constraints:**

- Reuse existing prompt detail/editor behavior.
- Do not alter AI prompt generation contracts.
- Do not add new copy fields.

**Acceptance criteria:**

- Direct `/prompts/[id]` renders a detail/editor surface or an approved PRD exception is documented.
- Prompt history link remains available.
- Mobile and desktop are usable.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/prompts/[id]` mobile and desktop.

**PR size limit:** 3 files, under 300 changed lines.

**Dependencies:** UI-010.

### UI-012 - Drive Browser Responsive Polish

**Goal:** Refine `/drive` as a Vercel-like asset browser.

**Files likely involved:**

- `src/app/drive/drive-visual-manager.tsx`
- `src/app/drive/page.tsx`
- `src/app/globals.css`

**Constraints:**

- Google Drive remains asset source of truth.
- No full edit forms in mobile preview sheets.
- No batch archive/delete.

**Acceptance criteria:**

- Mobile defaults to a dense usable list or compact grid.
- Tablet has intentional layout, not accidental mobile.
- Desktop preview drawer has better proportions.
- Upload and preview sheets remain action-first.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/drive` at 360px, 768px, 1024px, 1280px.
- Preview open on mobile and desktop.

**PR size limit:** 3 files, under 400 changed lines.

**Dependencies:** UI-004.

### UI-013 - Settings Hub Desktop Layout

**Goal:** Make `/settings` a professional dashboard hub on desktop while preserving mobile native list ergonomics.

**Files likely involved:**

- `src/app/settings/page.tsx`
- `src/app/settings/loading.tsx`
- `src/app/globals.css`

**Constraints:**

- Do not expand Workspace as a planning product.
- Do not add Settings > Drive as a separate primary config route.
- Do not touch secrets or account token behavior.

**Acceptance criteria:**

- Mobile remains grouped list.
- Desktop uses compact settings sections/cards with clear hierarchy.
- Gemini, Affiliate Profile, Workspace, and Account remain findable.
- Copy remains concise.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- `/settings` at 360px, 768px, 1024px, 1280px.

**PR size limit:** 3 files, under 300 changed lines.

**Dependencies:** UI-003.

### UI-014 - Settings Manager Pattern Pilot

**Goal:** Create a shared pattern for settings boards without touching all boards at once.

**Files likely involved:**

- `src/components/operator/settings-manager-shell.tsx`
- One pilot board, preferably `src/app/settings/affiliate-profiles/affiliate-profile-board.tsx`
- `src/app/globals.css`

**Constraints:**

- One settings board only.
- No mutation behavior changes.
- Preserve locked labels and fields.

**Acceptance criteria:**

- Pilot board has consistent toolbar, table/cards, drawer/sheet behavior.
- Mobile remains usable.
- Existing create/update/delete behavior remains unchanged.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- `/settings/affiliate-profiles` at 390px and 1280px with drawer open.

**PR size limit:** 3 files, under 350 changed lines.

**Dependencies:** UI-013.

### UI-015 - Indonesian Operational Copy Pass

**Goal:** Remove verbose or English helper copy from major UI states.

**Files likely involved:**

- `src/app/dashboard/error.tsx`
- `src/app/products/error.tsx`
- `src/app/prompts/error.tsx`
- `src/app/drive/error.tsx`
- `src/app/settings/page.tsx`
- `src/app/controller/page.tsx`, only if route still renders

**Constraints:**

- Do not change locked labels.
- No marketing language.
- No new workflow concepts.

**Acceptance criteria:**

- Major loading/empty/error states use concise Indonesian operational copy.
- No verbose helper paragraphs added.
- Controller/Flow copy is not promoted.

**Validation commands:**

- `npm run lint`
- `npm run typecheck`

**Screenshot requirements:**

- One example empty/error/loading state per major route where practical.

**PR size limit:** 6 files, under 220 changed lines.

**Dependencies:** UI-005 preferred.

### UI-016 - Final Responsive Screenshot QA

**Goal:** Validate the redesigned surfaces across required viewport bands.

**Files likely involved:**

- Playwright tests if added:
  - `tests/**`
  - `playwright.config.*`
- Otherwise docs-only QA notes

**Constraints:**

- No app redesign in this task.
- Do not introduce brittle data assumptions.

**Acceptance criteria:**

- Screenshots captured for mobile 360-767, tablet 768-1023, desktop 1024-1279, wide 1280+.
- Checked routes include `/dashboard`, `/products/new`, `/products`, `/prompts`, `/drive`, `/settings`.
- Any remaining overflow/overlap is documented.

**Validation commands:**

- `npm run smoke:e2e`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

**Screenshot requirements:**

- All major redesigned surfaces at 360, 768, 1024, and 1280 widths.

**PR size limit:** docs/test-only unless tiny CSS fixes are approved.

**Dependencies:** All route redesign tasks.

## 10. Recommended Branch Plan

1. `ui/audit-current-surfaces`
2. `ui/design-source-of-truth`
3. `ui/shell-foundation`
4. `ui/shared-components`
5. `ui/dashboard-redesign`
6. `ui/intake-redesign`
7. `ui/products-redesign`
8. `ui/prompt-workstation`
9. `ui/drive-browser`
10. `ui/settings-hub`
11. `ui/final-responsive-polish`

Suggested mapping:

- `ui/audit-current-surfaces`: UI-001
- `ui/design-source-of-truth`: UI-002, UI-003
- `ui/shell-foundation`: shell/nav visual polish after UI-002
- `ui/shared-components`: UI-004, UI-005
- `ui/dashboard-redesign`: UI-006
- `ui/intake-redesign`: UI-007
- `ui/products-redesign`: UI-008, UI-009
- `ui/prompt-workstation`: UI-010, UI-011
- `ui/drive-browser`: UI-012
- `ui/settings-hub`: UI-013, UI-014
- `ui/final-responsive-polish`: UI-015, UI-016

## 11. First 5 Micro Tasks To Execute

1. **UI-002 - Restore PRD Route And Nav Locks**  
   This fixes the highest-risk product drift before visual work. It is small, concrete, and prevents later screenshots from validating the wrong shell.

2. **UI-003 - Fix Design Token Audit Coverage**  
   Broad redesign work should not proceed while the audit scripts miss hardcoded values in `src/app/globals.css`.

3. **UI-005 - Add Shared ErrorState**  
   This is low-risk, improves consistency, and gives later route redesigns a reusable state primitive.

4. **UI-004 - Create Shared Operator Toolbar Primitives**  
   Search/filter/action duplication appears across the highest-traffic operator routes. Start with one pilot route to keep the PR small.

5. **UI-006 - Dashboard Desktop Command Center**  
   `/dashboard` has high visibility and the clearest gap against the Vercel-inspired desktop target. It can be improved without changing product workflow or database behavior.
