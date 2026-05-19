# UI/UX Redesign Micro Tasks

This backlog is the Claude Code CLI execution queue for the Vercel-inspired responsive operator dashboard redesign. It is rebuilt from `docs/UI_UX_REDESIGN_AUDIT.md`, `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`, and `docs/PRD_SOURCE_OF_TRUTH.md`.

All tasks must preserve the PRD route, navigation, workflow, copy, storage, schema, and Controller/Flow locks. UI-002 is the first implementation task after the docs set is committed.

## Current Phase Interpretation

This redesign queue is valid only when interpreted with the current phase locks. Phase 1-only Controller redirect guidance is superseded where it conflicts with approved Phase 2 Controller reactivation. For any task touching Controller, Flow, Helper, prompt batch/queue, or Phase 2 production flow, `docs/PHASE_2_ARCHITECTURE_LOCK.md` is a required source of truth and wins for Controller/Helper-related work.

Unless the Phase 2 lock explicitly approves otherwise, the mobile/workflow navigation locks still apply: mobile nav remains `Dashboard`, `Intake`, `Produk`, `Prompt`, `Drive`; workflow navigation remains `Intake`, `Produk`, `Prompt`, `Drive`; Controller stays out of mobile/workflow navigation; `/flow` remains frozen; browser automation, Google Flow auto-submit, fake progress, mobile Flow queues, and unapproved primary mobile Flow UI remain forbidden.

## Foundation

## TASK UI-001 — Save Audit Handoff

### Owner

Claude Code CLI

### Goal

Ensure the audit handoff exists as the official reference document for redesign execution.

### Scope

Verify `docs/UI_UX_REDESIGN_AUDIT.md` exists and contains the factual audit report. Fix only obvious Markdown formatting problems if needed.

### Out of Scope

- App code changes.
- Schema, migration, config, or secret changes.
- New findings not present in the audit.

### Likely Files

- `docs/UI_UX_REDESIGN_AUDIT.md`

### Source of Truth

- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `AGENTS.md`

### Implementation Notes

If the file already exists and is readable, no code change is needed. Do not rewrite the audit content.

### Acceptance Criteria

- `docs/UI_UX_REDESIGN_AUDIT.md` exists.
- The document is readable Markdown.
- The document remains tied to actual repo files.

### Validation

```bash
git diff -- docs/UI_UX_REDESIGN_AUDIT.md
```

### Screenshots Required

None.

### PR Rules

- Docs-only.
- One file maximum.
- Confirm no app, schema, migration, secret, or config changes.

### Prompt For Claude

Read `AGENTS.md`, `docs/PRD_SOURCE_OF_TRUTH.md`, and `docs/UI_UX_REDESIGN_AUDIT.md`. Verify the audit handoff document exists and is readable. Fix only Markdown formatting if required. Do not touch app code.

## TASK UI-002 — Restore PRD Route And Nav Locks

### Owner

Claude Code CLI

### Goal

Fix the highest-risk PRD drift before any visual redesign work.

### Scope

Align root redirect, mobile nav order, workflow nav, and Controller access with the current phase locks.

### Out of Scope

- Controller redesign.
- Controller backend deletion.
- Unapproved Flow UI reactivation.
- Broad shell visual redesign.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/page.tsx`
- `src/app/controller/page.tsx`
- `src/components/operator/nav-config.ts`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/PHASE_2_ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- `/` must redirect to `/products/new`.
- `/controller` must redirect to `/products/new` only while frozen by the active phase lock.
- If Phase 2 Controller reactivation is active, defer desktop `/controller` behavior to `docs/PHASE_2_ARCHITECTURE_LOCK.md`.
- Mobile `/controller` behavior must keep Controller out of mobile navigation and must not introduce a mobile Flow queue.
- `/flow` already redirects; verify it remains unchanged.
- Mobile nav order must be `Dashboard`, `Intake`, `Produk`, `Prompt`, `Drive`.
- Workflow nav labels are `Intake`, `Produk`, `Prompt`, `Drive`.
- Remove `Flow Control` and `Controller` from mobile/workflow navigation.
- Do not delete retained Controller/Flow backend code.

### Acceptance Criteria

- `/` redirects to `/products/new`.
- `/controller` follows the active phase lock: frozen redirect during Phase 1-only work, or approved desktop-only Controller behavior during Phase 2 reactivation.
- Desktop workflow nav does not expose `Flow Control` or `Controller`.
- Mobile bottom nav order matches the PRD exactly.
- Settings gear behavior is unchanged: visible on non-Settings routes, hidden on `/settings`.
- No unapproved Controller/Flow primary UI is introduced.

### Validation

```bash
npm run lint
npm run typecheck
npm run build
```

Run smoke coverage when practical:

```bash
npm run smoke:e2e
```

### Screenshots Required

- Mobile shell at `390px`.
- Desktop shell/sidebar at `1280px`.
- Optional route check notes for `/`, `/controller`, and `/flow`.

### PR Rules

- Keep the PR to the listed files unless a blocker is documented.
- Do not touch server actions, migrations, secrets, or config.
- Confirm all route/nav PRD locks are preserved.

### Prompt For Claude

Implement UI-002 only. Read the PRD, architecture lock, mobile lock, Phase 2 architecture lock, redesign source of truth, and audit. Update only the root redirect, Controller route behavior required by the active phase lock, and nav config needed to preserve the mobile/workflow nav locks. Do not redesign Controller or expose Flow outside approved Phase 2 desktop behavior. Run lint, typecheck, and build.

## TASK UI-003 — Fix Design Token Audit Coverage

### Owner

Claude Code CLI

### Goal

Make token enforcement match the repo's actual CSS and component patterns before broad visual work.

### Scope

Fix known token audit blind spots and tokenize the hardcoded values identified in the audit.

### Out of Scope

- Broad visual redesign.
- Route layout changes.
- New dependencies.
- Schema, migration, secret, or config changes.

### Likely Files

- `scripts/audit-color-tokens.mjs`
- `scripts/audit-typography-tokens.mjs`
- `src/app/globals.css`
- `src/components/operator/gemini-live-cycle-chart.tsx`

### Source of Truth

- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `AGENTS.md`

### Implementation Notes

- Audit found hardcoded values in `src/app/globals.css` that current scripts miss when declarations are minified or same-line.
- Audit found hardcoded Recharts typography in `src/components/operator/gemini-live-cycle-chart.tsx`.
- Keep chart behavior and data unchanged.
- Raw visual values should live only in the token source layer.

### Acceptance Criteria

- Color audit catches same-line color declarations.
- Typography audit catches same-line typography declarations.
- Known `.ui-card` hardcoded colors and typography are tokenized.
- Chart tick typography is token-compliant or CSS-backed.
- `npm run audit:colors` and `npm run audit:typography` pass.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/dashboard` chart at `1280px` if chart rendering changes visually.

### PR Rules

- Keep changes tightly scoped to token enforcement.
- Do not redesign pages.
- Confirm no hardcoded component colors or typography were added.

### Prompt For Claude

Implement UI-003 only. Improve the token audit scripts so they catch same-line declarations, then tokenize the known hardcoded UI values from the audit. Keep behavior unchanged. Run color audit, typography audit, lint, typecheck, and build.

## TASK UI-004 — Shared Operator Toolbar Primitives

### Owner

Claude Code CLI

### Goal

Create shared toolbar primitives for repeated search, filter, and action patterns.

### Scope

Add shared `SearchInput`, `FilterChips`, and `ActionToolbar` components and pilot them on one route.

### Out of Scope

- Broad refactors across all routes.
- Data fetching changes.
- Copy changes beyond existing labels.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/components/operator/search-input.tsx`
- `src/components/operator/filter-chips.tsx`
- `src/components/operator/action-toolbar.tsx`
- `src/app/products/product-list.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Pilot the shared primitives on `/products` only.
- Preserve existing filter/search behavior.
- Use semantic color and typography tokens.
- Toolbar must wrap cleanly on mobile and stay compact on desktop.

### Acceptance Criteria

- Shared toolbar primitives exist.
- `/products` uses the new primitives without behavior regression.
- Mobile product list remains usable.
- Desktop toolbar is compact and border-driven.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/products` at `390px`.
- `/products` at `768px`.
- `/products` at `1280px`.

### PR Rules

- Pilot one route only.
- Avoid unrelated CSS cleanup.
- Confirm PRD nav and route locks are unchanged.

### Prompt For Claude

Implement UI-004 only. Create shared operator toolbar primitives and adopt them on `src/app/products/product-list.tsx` only. Preserve search/filter behavior and labels. Run audits, lint, typecheck, and build.

## TASK UI-005 — Shared ErrorState

### Owner

Claude Code CLI

### Goal

Standardize route and inline error displays with concise Indonesian operational copy.

### Scope

Create a shared `ErrorState` and adopt it on major route error files.

### Out of Scope

- Changing error boundaries behavior beyond presentation.
- Adding verbose troubleshooting copy.
- Server action or API changes.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/components/operator/error-state.tsx`
- `src/app/dashboard/error.tsx`
- `src/app/products/error.tsx`
- `src/app/prompts/error.tsx`
- `src/app/drive/error.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`

### Implementation Notes

- Error copy must be one concise Indonesian sentence.
- Preserve retry actions where they already exist.
- Do not show stack traces or technical diagnostics in normal UI.

### Acceptance Criteria

- Shared `ErrorState` exists.
- Dashboard, Products, Prompts, and Drive route errors use it.
- Retry behavior remains available where previously available.
- No verbose or English error copy is introduced.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- One forced or documented route error state if practical.
- If forcing errors is not practical, include manual screenshot notes in the handoff.

### PR Rules

- Keep this presentation-only.
- Do not touch data fetching or server code.
- Confirm no English operational copy was added.

### Prompt For Claude

Implement UI-005 only. Add a shared ErrorState component and adopt it in the major route error files. Keep copy concise and Indonesian. Preserve retry actions. Run audits, lint, typecheck, and build.

## TASK UI-006 — Shared Data/List Primitives If Needed

### Owner

Claude Code CLI

### Goal

Add the smallest shared list and card primitives needed for later route redesign tasks.

### Scope

Introduce shared `DataList`, `EntityCard`, and `MetricCard` primitives if local duplication still warrants them. Keep route adoption minimal.

### Out of Scope

- Full product, prompt, Drive, or settings redesign.
- Data query changes.
- Mutation changes.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/components/operator/data-list.tsx`
- `src/components/operator/entity-card.tsx`
- `src/components/operator/metric-card.tsx`
- `src/app/globals.css`
- One pilot usage only if needed:
  - `src/app/dashboard/page.tsx`
  - or `src/app/products/product-list.tsx`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/ARCHITECTURE_LOCK.md`

### Implementation Notes

- Prefer small, composable primitives.
- Do not build a full component library.
- If a primitive is not clearly needed, do not add it.
- Any pilot usage must be limited to one surface and preserve behavior.

### Acceptance Criteria

- Needed shared primitives exist or the handoff explains why they were deferred.
- Any adopted route keeps existing behavior.
- Components use semantic tokens.
- Components support loading, empty, or row/action patterns where relevant.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- If a route is visually changed, capture that route at `390px` and `1280px`.
- None if only unused primitives are added.

### PR Rules

- Keep the PR small.
- Avoid broad route migration.
- Confirm no workflow, schema, or mutation behavior changed.

### Prompt For Claude

Implement UI-006 only. Inspect existing duplication and add only the smallest shared DataList, EntityCard, or MetricCard primitives needed for the redesign. Pilot at most one route if necessary. Run audits, lint, typecheck, and build.

## Route Redesign

## TASK UI-010 — Dashboard Desktop Command Center

### Owner

Claude Code CLI

### Goal

Make `/dashboard` a compact operator command center on desktop without changing its secondary analytics role.

### Scope

Redesign dashboard layout using existing data, states, and actions.

### Out of Scope

- New analytics data.
- New dashboard workflow actions.
- Making dashboard the primary entrypoint.
- Schema, migration, API, secret, or config changes.

### Likely Files

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/dashboard/error.tsx`
- `src/components/operator/gemini-usage-overview.tsx`
- `src/components/operator/gemini-live-cycle-chart.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Use only real existing counts and status data.
- Avoid centered mobile-width card stacks on desktop.
- Mobile must remain compact and readable.
- Wide desktop should use width intentionally without stretching cards.

### Acceptance Criteria

- Dashboard remains secondary analytics.
- Mobile layout remains usable.
- Desktop uses a clear grid or split layout.
- Wide desktop avoids stretched cards.
- Loading, empty, and error states remain present.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/dashboard` at `390px`.
- `/dashboard` at `768px`.
- `/dashboard` at `1024px`.
- `/dashboard` at `1280px` or `1440px`.

### PR Rules

- Keep to dashboard presentation files.
- Do not add metrics or new workflow concepts.
- Confirm route/nav locks remain unchanged.

### Prompt For Claude

Implement UI-010 only. Redesign `/dashboard` into a compact operator command center using existing data and states. Do not add new metrics or make dashboard primary. Run audits, lint, typecheck, and build, and provide screenshots at the required widths.

## TASK UI-011 — Intake Desktop Hierarchy Pass

### Owner

Claude Code CLI

### Goal

Improve `/products/new` desktop hierarchy while preserving the locked Intake lifecycle.

### Scope

Adjust Intake layout so desktop has a clear primary Intake column and subordinate secondary panels.

### Out of Scope

- Server action changes.
- Schema changes.
- New Intake fields.
- Affiliate profile switching carousel.
- Changing `Simpan Produk` or `Analisis Metadata` lifecycle.

### Likely Files

- `src/app/products/new/page.tsx`
- `src/app/products/new/intake-workflow-form.tsx`
- `src/app/products/new/bulk-import-panel.tsx`
- `src/app/products/new/loading.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Intake remains `/products/new`.
- `Simpan Produk` and `Analisis Metadata` remain separate.
- Desktop bulk import must not visually compete with primary Intake.
- Tablet must not be an accidental stretched mobile state.

### Acceptance Criteria

- Mobile remains first-class.
- Desktop hierarchy clearly prioritizes Intake.
- Bulk import or secondary panels are visually subordinate.
- Loading, empty, and error states remain intact.
- No profile switching is added to Intake.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/products/new` at `390px`.
- `/products/new` at `768px`.
- `/products/new` at `1024px`.
- `/products/new` at `1280px` or `1440px`.

### PR Rules

- Do not touch server actions.
- Do not add new form fields or lifecycle transitions.
- Confirm Intake PRD locks are preserved.

### Prompt For Claude

Implement UI-011 only. Improve `/products/new` desktop and tablet layout while preserving the locked Intake lifecycle and all existing actions. Do not change server behavior. Run audits, lint, typecheck, and build, and provide screenshots.

## TASK UI-012 — Products List And Detail Polish

### Owner

Claude Code CLI

### Goal

Make `/products` more data-first, compact, and consistent across mobile and desktop.

### Scope

Polish product list, product cards/table, detail panel presentation, and empty states.

### Out of Scope

- Product lifecycle changes.
- Product query changes unless required for UI rendering bug fixes.
- Product detail route compliance; that is UI-013.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/products/page.tsx`
- `src/app/products/product-list.tsx`
- `src/app/products/product-detail-panel.tsx`
- `src/app/products/product-metadata-sheet.tsx`
- `src/app/products/product-output-fields.tsx`
- `src/app/products/loading.tsx`
- `src/app/products/error.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Mobile uses compact cards.
- Desktop prefers searchable list/table with side drawer.
- Product detail still exposes Metadata, Output, and History affordances.
- Use shared toolbar/state components if already available.

### Acceptance Criteria

- Mobile product cards remain action-friendly.
- Desktop product list is compact and scannable.
- Product empty states use shared patterns where available.
- Detail panel remains usable and does not expose unapproved technical metadata.
- No product status or lifecycle semantics change.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/products` at `390px`.
- `/products` at `768px`.
- `/products` at `1280px` or `1440px`.
- Product detail open on mobile and desktop.

### PR Rules

- Presentation-focused.
- Do not solve `/products/[id]` in this PR.
- Confirm no schema, server action, or lifecycle changes.

### Prompt For Claude

Implement UI-012 only. Polish `/products` list and detail presentation using existing data and behavior. Keep mobile cards, improve desktop density, and preserve product lifecycle. Run audits, lint, typecheck, and build with screenshots.

## TASK UI-013 — Product Detail Route Compliance

### Owner

Claude Code CLI

### Goal

Resolve the PRD mismatch where `/products/[id]` currently behaves as a redirect-only compatibility route.

### Scope

Make direct product detail route access compliant or document a user-approved exception before implementation.

### Out of Scope

- Product list redesign.
- Product lifecycle changes.
- New metadata routes.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/products/[id]/page.tsx`
- `src/app/products/[id]/loading.tsx`
- `src/app/products/[id]/error.tsx`
- `src/app/products/product-detail-panel.tsx`
- `src/app/products/product-metadata-sheet.tsx`
- `src/app/products/product-output-fields.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- PRD says `/products/[id]` is product detail with Metadata, Output, and History.
- Prefer reusing existing detail components.
- Preserve query-param drawer behavior unless the user approves removing it.
- Do not expose technical audit data in the main Metadata tab.

### Acceptance Criteria

- Direct `/products/[id]` renders a usable detail surface or an approved exception is documented.
- Metadata, Output, and History remain reachable.
- Mobile and desktop layouts are usable.
- Existing `/products?detail=...` behavior remains unless explicitly approved otherwise.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

Run smoke coverage when practical:

```bash
npm run smoke:e2e
```

### Screenshots Required

- `/products/[id]` at `390px`.
- `/products/[id]` at `1280px` or `1440px`.

### PR Rules

- Keep route compliance isolated.
- Do not change product schema or lifecycle.
- Confirm PRD route locks remain preserved.

### Prompt For Claude

Implement UI-013 only. Resolve direct `/products/[id]` route compliance by reusing existing product detail components where possible. Preserve existing query drawer behavior unless explicitly approved. Run audits, lint, typecheck, and build.

## TASK UI-014 — Prompt Workbench Desktop Density

### Owner

Claude Code CLI

### Goal

Make `/prompts` a compact desktop prompt workstation while preserving mobile prompt behavior.

### Scope

Polish prompt list/workbench, prompt detail panel, queue drawer presentation, and desktop density.

### Out of Scope

- Prompt generation contract changes.
- New prompt output fields.
- Unapproved Flow execution UI exposure from the prompt workbench.
- Prompt detail route compliance; that is UI-015.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/prompts/page.tsx`
- `src/app/prompts/prompt-workbench-list.tsx`
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-output-fields.tsx`
- `src/app/prompts/prompt-queue-drawer.tsx`
- `src/app/prompts/loading.tsx`
- `src/app/prompts/error.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/PHASE_2_ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- Preserve `Paket Prompt`, `Prompt Clip 1`, `Prompt Clip 2`, `Caption`, `Tags`, `Target Marketplace`, and `Instruksi Revisi`.
- Mobile remains card/sheet-oriented.
- Desktop should reduce vertical card scanning.
- Do not expose Controller readiness actions or Flow execution UI from the prompt surface unless a Phase 2 task explicitly approves it.
- Keep the ban on mobile Flow queues, browser automation, Google Flow auto-submit, fake progress, and unapproved primary mobile Flow UI.

### Acceptance Criteria

- Desktop prompt workbench is compact and scannable.
- Mobile prompt list remains usable.
- Copy-ready fields remain clear and read-only.
- Prompt lifecycle and generation behavior are unchanged.
- Loading, empty, and error states remain.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/prompts` at `390px`.
- `/prompts` at `768px`.
- `/prompts` at `1024px`.
- `/prompts` at `1280px` or `1440px`.
- Prompt detail open on mobile and desktop.

### PR Rules

- Do not change prompt contracts.
- Do not add unapproved Flow/Controller primary UI.
- Confirm locked prompt labels remain unchanged.

### Prompt For Claude

Implement UI-014 only. Redesign `/prompts` desktop density while preserving mobile behavior and all locked prompt labels/contracts. Do not expose Flow execution UI from the prompt surface unless the active Phase 2 task explicitly approves it, and do not add mobile Flow queue, browser automation, auto-submit, or fake progress. Run audits, lint, typecheck, and build with screenshots.

## TASK UI-015 — Prompt Detail Route Compliance

### Owner

Claude Code CLI

### Goal

Resolve the PRD mismatch where `/prompts/[id]` currently behaves as a redirect-only compatibility route.

### Scope

Make direct prompt detail route access compliant or document a user-approved exception before implementation.

### Out of Scope

- Prompt generation contract changes.
- Prompt workbench redesign.
- New prompt fields or actions.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/prompts/[id]/page.tsx`
- `src/app/prompts/[id]/loading.tsx`
- `src/app/prompts/[id]/history/page.tsx`
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-output-fields.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`

### Implementation Notes

- PRD says `/prompts/[id]` is the prompt detail/editor output surface.
- Prefer reusing existing prompt detail components.
- Preserve query-param detail behavior unless the user approves removing it.
- History link remains available.

### Acceptance Criteria

- Direct `/prompts/[id]` renders a usable prompt detail/editor surface or an approved exception is documented.
- Locked prompt labels and actions remain unchanged.
- `/prompts/[id]/history` remains reachable.
- Mobile and desktop layouts are usable.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

Run smoke coverage when practical:

```bash
npm run smoke:e2e
```

### Screenshots Required

- `/prompts/[id]` at `390px`.
- `/prompts/[id]` at `1280px` or `1440px`.

### PR Rules

- Keep route compliance isolated.
- Do not change prompt JSON contracts.
- Confirm no unapproved Flow/Controller primary UI is introduced.

### Prompt For Claude

Implement UI-015 only. Resolve direct `/prompts/[id]` route compliance by reusing existing prompt detail components. Preserve locked labels, history access, and existing behavior. Run audits, lint, typecheck, and build.

## TASK UI-016 — Drive Browser Visual Refinement

### Owner

Claude Code CLI

### Goal

Refine `/drive` into a compact visual asset browser across mobile, tablet, and desktop.

### Scope

Polish Drive grid/list, breadcrumb/browser hierarchy, preview drawer, and mobile bottom sheet presentation.

### Out of Scope

- Drive upload/storage behavior changes.
- Batch archive/delete mutations.
- Full edit forms in preview sheets.
- Google Drive OAuth changes.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/drive/page.tsx`
- `src/app/drive/drive-visual-manager.tsx`
- `src/app/drive/loading.tsx`
- `src/app/drive/error.tsx`
- `src/components/operator/media-thumbnail-frame.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Google Drive remains the asset source of truth.
- Mobile preview uses bottom sheet.
- Desktop preview may use right drawer.
- List mode on mobile must be compact and not a dense table.
- Long-press selection must still have tap/click fallback.

### Acceptance Criteria

- Mobile Drive browser is touch-friendly.
- Tablet layout is intentional.
- Desktop preview drawer uses width well.
- Drive remains browser/preview, not full edit surface.
- No batch archive/delete is added.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/drive` at `390px`.
- `/drive` at `768px`.
- `/drive` at `1024px`.
- `/drive` at `1280px` or `1440px`.
- Preview open on mobile and desktop.

### PR Rules

- Presentation-only unless a blocker is documented.
- Do not touch Drive OAuth or server upload paths.
- Confirm Drive constraints remain intact.

### Prompt For Claude

Implement UI-016 only. Refine `/drive` visual browser presentation across mobile/tablet/desktop while preserving Drive behavior and constraints. Do not add batch mutations or edit forms in preview sheets. Run audits, lint, typecheck, and build.

## TASK UI-017 — Settings Hub Desktop Layout

### Owner

Claude Code CLI

### Goal

Make `/settings` a compact desktop settings hub while preserving mobile grouped-list behavior.

### Scope

Polish Settings overview layout, grouping, and desktop density.

### Out of Scope

- Settings subsection CRUD redesign.
- Account token or Chrome pairing changes.
- New Settings routes.
- Workspace expansion as a planning model.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/settings/page.tsx`
- `src/app/settings/loading.tsx`
- `src/app/settings/error.tsx`
- `src/components/operator/gemini-usage-overview.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- Mobile should keep native grouped-list feel.
- Desktop should use compact sections/cards without marketing copy.
- Google Drive status stays on Settings overview row.
- `/settings/drive` remains a redirect.
- Sign out stays only in Account.

### Acceptance Criteria

- Mobile Settings overview remains compact and usable.
- Desktop Settings hub uses width intentionally.
- Affiliate Profiles, Gemini, Google Drive, Account, and retained Workspace support remain findable.
- No new Settings nav stack is introduced.
- Workspace is not expanded as a planning model.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/settings` at `390px`.
- `/settings` at `768px`.
- `/settings` at `1024px`.
- `/settings` at `1280px` or `1440px`.

### PR Rules

- Do not touch account secret/token behavior.
- Do not add Settings > Drive UI.
- Confirm Settings gear rule is preserved.

### Prompt For Claude

Implement UI-017 only. Redesign `/settings` overview layout for desktop while preserving mobile grouped-list behavior and all Settings constraints. Do not touch secrets, account token behavior, or Settings routes. Run audits, lint, typecheck, and build.

## TASK UI-018 — Settings Manager Pattern Pilot

### Owner

Claude Code CLI

### Goal

Create a reusable settings manager pattern through one safe pilot board.

### Scope

Pilot shared settings list/table/card/drawer structure on Affiliate Profiles only.

### Out of Scope

- Refactoring all settings boards.
- Mutation behavior changes.
- Field contract changes.
- Gemini key behavior changes.
- Workspace concept expansion.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/components/operator/settings-manager-shell.tsx`
- `src/app/settings/affiliate-profiles/affiliate-profile-board.tsx`
- `src/app/settings/affiliate-profiles/page.tsx`
- `src/app/settings/affiliate-profiles/loading.tsx`
- `src/app/globals.css`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- Pilot one board only: Affiliate Profiles.
- Preserve drawer CRUD behavior.
- Preserve `Lock Character` and `Lock Environment` labels.
- Do not expose many-to-many workspace choices.
- Do not show internal `notes` fields in forms.

### Acceptance Criteria

- Affiliate Profiles board uses the pilot settings manager pattern.
- Mobile uses compact cards plus drawer/sheet behavior.
- Desktop uses compact list/table plus right drawer.
- Existing create/update/archive/delete behavior remains unchanged.
- Locked labels and fields remain intact.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/settings/affiliate-profiles` at `390px`.
- `/settings/affiliate-profiles` at `1280px` or `1440px`.
- Drawer open on mobile and desktop.

### PR Rules

- One settings board only.
- Do not touch server actions unless a rendering blocker is documented.
- Confirm no schema, secret, or config changes.

### Prompt For Claude

Implement UI-018 only. Create a reusable settings manager shell and pilot it on Affiliate Profiles only. Preserve all mutation behavior, labels, locks, and drawer fields. Run audits, lint, typecheck, and build with screenshots.

## TASK UI-019 — Indonesian Operational Copy Pass

### Owner

Claude Code CLI

### Goal

Remove verbose or English operational copy from changed major UI states.

### Scope

Pass through major route error, empty, loading, and overview copy touched by the redesign.

### Out of Scope

- Locked label changes.
- Marketing copy additions.
- New workflow concepts.
- Broad content rewrite.
- Schema, migration, secret, or config changes.

### Likely Files

- `src/app/dashboard/error.tsx`
- `src/app/products/error.tsx`
- `src/app/prompts/error.tsx`
- `src/app/drive/error.tsx`
- `src/app/settings/page.tsx`
- `src/app/products/product-list.tsx`
- `src/app/prompts/prompt-workbench-list.tsx`
- `src/app/drive/drive-visual-manager.tsx`

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/PHASE_2_ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- Preserve locked labels exactly.
- Empty states and error states get one concise Indonesian sentence.
- Do not add helper paragraphs.
- If `/controller` is frozen and redirects after UI-002, do not edit Controller copy.
- If `/controller` is active under the Phase 2 lock, any Controller copy pass must preserve desktop-only scope and avoid mobile Flow queue, browser automation, auto-submit, or fake progress claims.

### Acceptance Criteria

- Major route states use concise Indonesian operational copy.
- No verbose helper or marketing copy is added.
- No locked prompt, nav, route, action, or field labels are changed.
- Controller/Flow is not promoted through copy outside approved Phase 2 desktop scope.

### Validation

```bash
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- Any changed empty/error/loading state at `390px`.
- Any changed overview copy at `1280px`.

### PR Rules

- Copy-only plus minimal markup if required.
- No route, action, or lifecycle changes.
- Confirm no English operational copy was added.

### Prompt For Claude

Implement UI-019 only. Clean up verbose or English UI state copy on major surfaces. Preserve all locked labels and do not add explanatory copy. Run lint, typecheck, and build with screenshots or notes for changed states.

## QA

## TASK UI-030 — Final Responsive Screenshot QA

### Owner

Claude Code CLI

### Goal

Verify redesigned surfaces across the required responsive bands.

### Scope

Capture or automate screenshots and document remaining responsive issues.

### Out of Scope

- New visual redesign work.
- Large CSS fixes.
- Data model changes.
- Schema, migration, secret, or config changes.

### Likely Files

- `tests/e2e/ui-responsive.spec.ts`
- `docs/UI_UX_REDESIGN_QA.md`
- `playwright.config.ts`, only if existing config requires a minimal screenshot path adjustment

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`

### Implementation Notes

- Check `/dashboard`, `/products/new`, `/products`, `/prompts`, `/drive`, and `/settings`.
- Include direct detail routes if UI-013 and UI-015 have landed.
- Prefer documenting issues over making broad fixes.
- Tiny overflow fixes may be split into follow-up tasks unless explicitly approved.

### Acceptance Criteria

- Responsive QA covers `390px`, `768px`, `1024px`, and `1280px` or `1440px`.
- Major redesigned surfaces are checked.
- Any remaining overflow, overlap, or shell issue is documented.
- No UI feature work is added.

### Validation

```bash
npm run smoke:e2e
npm run lint
npm run typecheck
npm run build
```

### Screenshots Required

- `/dashboard` at all required widths.
- `/products/new` at all required widths.
- `/products` at all required widths.
- `/prompts` at all required widths.
- `/drive` at all required widths.
- `/settings` at all required widths.

### PR Rules

- QA/test/docs-focused.
- Do not hide failures with broad CSS changes.
- Document any skipped route and why.

### Prompt For Claude

Implement UI-030 only. Run final responsive screenshot QA for the redesigned surfaces at 390, 768, 1024, and 1280 or 1440 widths. Add focused Playwright coverage or QA notes. Do not redesign surfaces in this task.

## TASK UI-031 — Accessibility And Focus QA

### Owner

Claude Code CLI

### Goal

Verify keyboard, focus, and accessible state behavior after the visual redesign.

### Scope

Check shell navigation, drawers, bottom sheets, overflow menus, buttons, search fields, and copy fields.

### Out of Scope

- Large component rewrites.
- New design features.
- Automated accessibility tooling dependencies unless explicitly approved.
- Schema, migration, secret, or config changes.

### Likely Files

- `tests/e2e/ui-accessibility-focus.spec.ts`
- `src/components/app-shell.tsx`
- `src/components/operator/detail-drawer.tsx`
- `src/components/operator/bottom-sheet.tsx`
- `src/components/ui/native-button.tsx`
- `src/components/ui/overflow-action-menu.tsx`
- `src/components/operator/copyable-readonly-field.tsx`
- `docs/UI_UX_REDESIGN_QA.md`

### Source of Truth

- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`

### Implementation Notes

- Prefer small fixes for missing labels, focus traps, focus restoration, and keyboard access.
- Do not introduce new dependencies.
- Document any issue that is too broad for this task.

### Acceptance Criteria

- Shell nav and Settings gear are keyboard reachable.
- Drawers and bottom sheets have usable focus behavior.
- Overflow menus and copy buttons are keyboard reachable.
- Interactive icon buttons have accessible labels.
- No PRD route/nav locks are changed.

### Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke:e2e
```

### Screenshots Required

- Screenshots only if a visual focus state or layout changes.
- Otherwise include QA notes.

### PR Rules

- Keep fixes small and accessibility-focused.
- Do not add dependencies without approval.
- Split broad component rewrites into follow-up tasks.

### Prompt For Claude

Implement UI-031 only. Perform accessibility and focus QA on the redesigned shell, drawers, sheets, menus, and copy controls. Make only small focused fixes. Run lint, typecheck, build, and smoke tests.

## TASK UI-032 — Final PRD Compliance Review

### Owner

Claude Code CLI

### Goal

Perform the final redesign compliance review against PRD route, nav, workflow, copy, and non-goal locks.

### Scope

Review the completed UI redesign and produce a final compliance note.

### Out of Scope

- New UI implementation.
- Schema or migration changes.
- Secret, token, `.env`, or production config changes.
- New Controller/Flow reactivation work outside approved Phase 2 locks.

### Likely Files

- `docs/UI_UX_REDESIGN_FINAL_REVIEW.md`
- `docs/UI_UX_REDESIGN_QA.md`, only if appending QA conclusions is preferred

### Source of Truth

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/PHASE_2_ARCHITECTURE_LOCK.md`
- `docs/UI_UX_REDESIGN_SOURCE_OF_TRUTH.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

### Implementation Notes

- Review must explicitly check route redirects, nav labels/order, Settings gear, Intake lifecycle, Prompt labels, Drive constraints, Settings constraints, copy policy, and Controller/Flow behavior against the current phase locks.
- Phase 1-only Controller dormancy checks are superseded where `docs/PHASE_2_ARCHITECTURE_LOCK.md` approves desktop Controller reactivation.
- The review must still confirm no mobile Flow queue, browser automation, Google Flow auto-submit, fake progress, or unapproved primary mobile Flow UI was introduced.
- If a violation remains, document it as a blocker or follow-up.
- Do not fix violations inside this review task unless the user explicitly approves.

### Acceptance Criteria

- Final review document exists.
- PRD compliance status is clear.
- Any remaining issues are listed with exact files and recommended follow-up task.
- Review confirms no schema, migration, secret, or config changes.

### Validation

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

Run smoke coverage when practical:

```bash
npm run smoke:e2e
```

### Screenshots Required

- None required unless the review identifies a visual blocker needing evidence.

### PR Rules

- Docs/review-focused.
- Do not implement new UI in this task.
- Confirm no unapproved Controller/Flow primary UI was introduced.

### Prompt For Claude

Implement UI-032 only. Perform a final compliance review of the completed UI redesign against the current phase locks, including the Phase 2 architecture lock for Controller/Helper-related behavior. Create a concise final review document with exact files for any remaining issues. Do not implement UI changes in this task.
