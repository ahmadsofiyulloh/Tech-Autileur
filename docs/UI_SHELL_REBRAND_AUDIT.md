# UI Shell Rebrand Audit

## Status

`UI-SHELL-REBRAND-01` is complete as a docs-only audit.

No runtime code, CSS, routes, actions, server queries, form contracts, schema, helper contracts, or dependencies are changed by this audit.

## Audit Basis

This audit follows `docs/UI_SHELL_REBRAND_LOCK.md` and uses `huashu-design/SKILL.md` only as a UI/UX discipline reference. The reference is applied as assumptions-first review, anti-AI-slop critique, system-first visual decisions, placeholder honesty, and visual hierarchy before decoration.

Inspected app surfaces:

- `src/app/layout.tsx`
- `src/components/app-shell.tsx`
- `src/app/globals.css`
- `src/components/operator/nav-config.ts`
- `src/components/operator/section-card.tsx`
- `src/components/operator/status-badge.tsx`
- `src/components/operator/empty-state.tsx`
- `src/app/controller/page.tsx`
- `src/app/prompts/page.tsx`
- `src/app/products/new/page.tsx`
- `src/app/products/product-list.tsx`
- `src/app/drive/page.tsx`
- `src/app/drive/drive-visual-manager.tsx`
- `src/app/settings/account/page.tsx`
- `src/app/settings/chrome-pairing-panel.tsx`
- `src/app/settings/helper-api-token-panel.tsx`

## Executive Finding

The current UI is functional, dense, and already uses many shared classes, but the shell still reads as assembled instead of fully designed. The main causes are repeated equal-weight cards, decorative icon frames, gradient/glow surfaces, badge-heavy summaries, and route-specific layout grammar that makes unrelated workflows feel visually similar.

The rebrand should start with global shell and token polish before route-level work. The next task must not redesign behavior. It should reduce visual noise, clarify surface hierarchy, and make the app feel like a private production operating system with a mobile control cockpit and desktop batch workstation.

## Global Shell Findings

### Strengths

- One app shell owns desktop sidebar, topbar, mobile bottom navigation, route titles, feedback dock, and bulk import runner.
- Mobile and desktop navigation are intentionally separated.
- Shared primitives exist for section cards, empty states, status badges, native buttons, bottom sheets, thumbnails, tables, filters, and detail layouts.
- `src/app/layout.tsx` loads Inter and keeps metadata, viewport, theme scripts, and app shell ownership centralized.
- Route polish can mostly happen through tokens, shell classes, and route layout wrappers without touching data behavior.

### Rebrand Gaps

- `font-sans` in `src/app/globals.css` still references `--font-geist-sans` even though `src/app/layout.tsx` defines `--font-inter`.
- Decorative gradients and glow patterns appear in page background, sidebar, active nav, icon frames, metric surfaces, dashboard action cards, and several route-specific surfaces.
- `icon-frame` is a global visual habit. It makes functional icons, empty states, section headers, and topbar identity compete for attention.
- `section-card.panel`, `muted-box`, product cards, prompt cards, Drive tiles, list rows, and preview drawers often have similar visual weight.
- `settings-inline-summary` is reused across unrelated workflows, which keeps the app consistent but can make controller, prompts, products, and Drive feel like the same generic dashboard pattern.
- Badge/status density is high. Some badges are useful operational state, but page labels, counts, filters, and profile names can become arbitrary badge clutter.
- Several component-specific measurements live directly in global CSS. CSS token usage is strong, but the next polish should consolidate spacing, radius, shadow, surface, and control rhythm rather than adding more local values.

## Route Audit

### `/controller`

Current read:

- The primary four-lane board has been replaced with a desktop stepped workflow shell.
- The route shows active workspace, current stage, step rail, stage sections, prompt-ready cards, batch setup selection, manifest export, helper prep, manual run, output import, reconcile/close, and support panels.
- Flow account state is labeled as estimated availability and lane key presence, not helper verified.

Keep:

- Horizontal stepper and visible current stage.
- Active workspace summary.
- Stage-separated batch production flow.
- Support panels as secondary content.

Rebrand risk:

- Step sections and batch cards can still read as stacked cards with similar weight.
- Count badges and summary strip can compete with the actual active stage.
- The route needs a stronger workstation hierarchy: active step first, inactive stages quieter, batch cards more scan-oriented.

Later task focus:

- `UI-SHELL-CTRL-01` should compact batch cards, reduce repeated surface weight, make the active stage visually dominant, and keep Flow account state honest without adding new actions.

### `/prompts`

Current read:

- Prompt workbench uses search, inline summary, readiness tabs, paginated prompt rows, queue entry point, and optional detail panel.
- It already follows active workspace and workspace-aware prompt workbench data flow.

Keep:

- Search and readiness filters.
- Workbench list/detail rhythm.
- Prompt readiness counts and queue affordance.

Rebrand risk:

- Inline summary currently mixes count, page label, readiness filter, and profile/workspace label as equal badges.
- Filter tabs and summaries resemble products and Drive, so the prompt workbench does not yet have a distinct production-editor hierarchy.
- Page-level cards and prompt row cards need clearer density rules.

Later task focus:

- `UI-SHELL-PROMPTS-01` should make readiness the primary operational signal, reduce arbitrary badge feel, and tighten prompt row/detail hierarchy without changing queries or actions.

### `/products/new`

Current read:

- Intake route has an intake desktop grid with a primary workflow surface, PWA install card, workflow form, draft queue, and bulk import panel.
- Mobile remains the core intake cockpit, while desktop supports batch intake.

Keep:

- Intake workflow form as the primary surface.
- Draft queue and bulk import as production support surfaces.
- Existing form field names and post-save behavior.

Rebrand risk:

- PWA install card can visually compete with the intake workflow.
- Bulk import panel and intake workflow may read as two equal large cards instead of primary workflow plus secondary support.
- The route needs a clearer "capture first, batch support second" hierarchy.

Later task focus:

- `UI-SHELL-PRODUCT-NEW-01` should make the intake form dominant, subordinate PWA/install and bulk import surfaces, and improve desktop density without changing upload, AI, or draft behavior.

### `/products`

Current read:

- Products route uses search, inline summary, filters, desktop data table, mobile cards, and product detail panel.
- The desktop table is appropriate for production scanning.

Keep:

- Desktop table/list behavior.
- Detail panel pattern.
- Existing filter/search params.

Rebrand risk:

- Filter stack, inline summary, table, mobile cards, and detail panel need a consistent product inventory hierarchy.
- Multiple status badges per row can make status interpretation slower.
- The route should feel like an inventory console, not another generic card/list surface.

Later task focus:

- `UI-SHELL-PRODUCTS-01` should standardize table density, status grouping, action hierarchy, and detail-panel emphasis without changing lifecycle or route params.

### `/drive`

Current read:

- Drive route is workspace-scoped and uses search, view mode toggle, breadcrumb, inline summary, grid/list browser, selection state, preview drawer on desktop, and bottom sheets for mobile/file add flows.
- Drive visuals are useful and operationally meaningful.

Keep:

- Grid/list mode.
- Breadcrumb navigation.
- Desktop preview drawer.
- Mobile bottom sheet behavior.
- Workspace Drive scoping.

Rebrand risk:

- Drive tiles, list rows, preview drawer, metric grid, and summary actions can become surface-heavy.
- Preview metadata uses `metric-grid` and `metric` surfaces that can look like decorative stats even when the data is real.
- Search toolbar, inline summary, and action row use the same grammar as other routes, reducing route-specific clarity.

Later task focus:

- `UI-SHELL-DRIVE-01` should make Drive feel like an asset browser: visual grid/list first, preview details second, metadata compact and not decorative.

### `/settings/account`

Current read:

- Account page uses one `SectionCard` with Chrome pairing, helper API token, status badge, JSON previews, token controls, and sign out action.
- It includes honest states such as "Belum paired" and schema pending/error states.

Keep:

- Honest pairing and token states.
- Existing token generation, download, save hash, revoke, and sign out behavior.
- No claim of helper verification unless implemented.

Rebrand risk:

- Chrome pairing and App API Token panels are visually stacked inside one generic card.
- JSON blocks and destructive actions need clearer operational hierarchy.
- `StatusBadge` can imply stronger state confidence than the helper contract currently supports.

Later task focus:

- `UI-SHELL-SETTINGS-01` should clarify local-only pairing, app token state, and destructive actions without adding real helper verification.

## Anti-AI-Slop Findings

These issues should be reduced before adding any new UI surface:

- Generic card soup: repeated `panel`, `section-card`, `muted-box`, list cards, metric cards, and route cards often carry equal weight.
- Unnecessary icon frames: `icon-frame` is used broadly in section headers, empty states, topbar identity, and other surfaces.
- Decorative stats: `metric` and dashboard-style stat surfaces sometimes use ornament that competes with actual state.
- Random gradients: body background, sidebar, active nav, icons, cards, and action surfaces use multiple gradient styles.
- All-panels-equal hierarchy: primary workflow, support content, empty states, and detail panels can look similarly important.
- Filler copy risk: some empty/summary copy is concise, but future polish must avoid adding explanatory copy that does not change operator decisions.
- Arbitrary badges: page labels, filters, counts, profile labels, and statuses should not all use the same badge emphasis.
- Hardcoded visual values: future CSS work should add or reuse tokens rather than expanding route-specific one-off values.
- Route-specific hacks: any new layout exception must be documented and token-backed.

## Recommended Next Sequence

### `UI-SHELL-REBRAND-02` - Global Shell/Token Polish

Do this before route polish.

Allowed implementation focus:

- Align typography tokens with the loaded Inter font variable.
- Define clearer token-backed surface hierarchy for base shell, panels, cards, muted boxes, list rows, tables, detail drawers, and empty states.
- Reduce decorative gradients, glows, orbs, and unnecessary icon frame emphasis.
- Normalize spacing rhythm for dense production screens.
- Clarify button hierarchy and badge/status density.
- Preserve all route URLs, form field names, search params, server actions, queries, lifecycle behavior, manifest/helper contracts, and dependencies.

Required verification:

```bash
npm run lint
npm run typecheck
npm run build
```

### Route Polish After Global Shell

Proceed in locked order:

1. `UI-SHELL-CTRL-01` - controller shell polish.
2. `UI-SHELL-PROMPTS-01` - prompts shell polish.
3. `UI-SHELL-PRODUCT-NEW-01` - intake shell polish.
4. `UI-SHELL-PRODUCTS-01` - products shell polish.
5. `UI-SHELL-DRIVE-01` - drive shell polish.
6. `UI-SHELL-SETTINGS-01` - settings account shell polish.

## Implementation Guardrails

Later UI polish tasks must preserve:

- Supabase query behavior.
- Server action names and payloads.
- Form field names.
- Route URLs.
- Search params.
- Status enums.
- Lifecycle behavior.
- Manifest schema.
- Helper callback payloads.
- Windows Helper command behavior.
- Existing loading, empty, and error states.

Later UI polish tasks must not:

- Add features.
- Add dependencies.
- Install or copy `huashu-design`.
- Add browser automation.
- Add helper verification claims before the runtime exists.
- Hide unavailable states behind decorative placeholders.

## Audit Decision

The UI shell is ready for controlled presentation-only polish. The next step should be `UI-SHELL-REBRAND-02`, focused on global shell/token polish before route-specific changes.
