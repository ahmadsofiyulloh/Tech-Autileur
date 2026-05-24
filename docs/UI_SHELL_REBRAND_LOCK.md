# UI Shell Rebrand Lock

## Status

`LOCKED FOR DOCS-ONLY VISUAL SHELL POLISH PLANNING`.

This lock defines the allowed visual rebrand direction for Banplex OS UI polish work. It does not approve runtime behavior changes, schema changes, route changes, new features, or new dependencies.

## Reference Boundary

Reference source:

```text
GitHub: alchaincyf/huashu-design
Reference file: SKILL.md
Use: UI/UX discipline reference only
```

`huashu-design/SKILL.md` is adapted only for design discipline: assumptions-first workflow, anti-AI-slop review, system-first decisions, honest placeholders, and critique rigor.

Forbidden use:

- Do not install `huashu-design`.
- Do not copy Huashu components, assets, scripts, starters, or templates.
- Do not add Huashu animation, PPT, prototype, export, TTS, BGM, SFX, design advisor, or variation playground features.
- Do not treat Huashu as a runtime dependency, package, skill install, export pipeline, or product feature.

## Visual Direction

Banplex OS must feel like a private production operating system for one operator managing AI affiliate content production.

Target feel:

- Private production operating system.
- Mobile control cockpit for intake, review, prompt, and Drive control.
- Desktop batch workstation for controller and Flow helper operations.
- Calm, precise, dense, premium, and not flashy.
- Designed, not assembled.

The app must not feel like a generic AI-generated dashboard. It should read as an intentionally organized production tool with fewer, stronger surfaces and clear operational hierarchy.

## Huashu-Inspired Principles To Adopt

Use these as discipline rules for later UI polish tasks:

- Junior Designer workflow: lock assumptions before changing UI.
- Anti-AI-slop discipline: every visual element must earn its place.
- System-first visual decisions: tokens, shell rhythm, hierarchy, and surface grammar come before local decoration.
- Placeholder honesty: if a real value, asset, or state does not exist, show an honest empty or unavailable state instead of decorative filler.
- Fewer but stronger surfaces: reduce repeated panels and card stacks before adding new containers.
- Visual hierarchy before decoration: layout, density, grouping, and emphasis must solve the problem before color or ornament.
- No filler UI elements: do not add stats, icons, badges, copy, or gradients that do not carry operational meaning.

## Explicit Anti-AI-Slop Rules

Later UI polish must avoid:

- Generic card soup.
- Unnecessary icon frames.
- Decorative stats.
- Random gradients.
- All-panels-equal hierarchy.
- Filler copy.
- Arbitrary badges.
- Hardcoded visual values in component code.
- Route-specific visual hacks unless documented and token-backed.

Every badge, stat, icon, panel, divider, and action must represent a real state, real action, or real navigation affordance.

## Hard Allowed Scope

Visual shell polish may change only presentation and layout grammar.

Allowed:

- CSS/token polish.
- Shell visual hierarchy.
- Spacing rhythm.
- Surface/card treatment.
- Button hierarchy.
- Badge/status visual density.
- Responsive layout polish.
- Route-level visual arrangement without changing behavior.
- `className` and layout wrapper changes that do not affect data, actions, field names, submitted values, routes, or state transitions.

Allowed UI work must preserve existing loading, empty, error, and mutation behavior.

## Hard Forbidden Scope

Visual shell polish must not change product behavior or data contracts.

Forbidden:

- Changing Supabase queries.
- Changing server actions.
- Changing form field names.
- Changing route URLs.
- Changing search params.
- Changing status enums.
- Changing lifecycle behavior.
- Changing manifest schema.
- Changing helper callback payload.
- Changing Windows Helper command behavior.
- Adding new features.
- Adding new dependencies.
- Installing `huashu-design` as a package or skill.
- Copying Huashu components directly.

If a visual polish task appears to require any forbidden change, stop and split it into a separate approved micro-task.

## UI Critique Dimensions

Every later UI shell polish task must critique the target route against these dimensions before editing:

- Workflow clarity: the operator can tell what to do next.
- Visual hierarchy: primary state and primary action are obvious.
- Operational density: information is compact without becoming noisy.
- Visual consistency: tokens, spacing, surfaces, and action hierarchy match the shell.
- Mobile/desktop fit: mobile remains touch-first; desktop can be denser and workstation-like.
- AI-slop resistance: no filler cards, badges, copy, gradients, or icon decoration.

## Route Polish Order

Polish routes in this order:

1. `/controller`
2. `/prompts`
3. `/products/new`
4. `/products`
5. `/drive`
6. `/settings/account`

This order prioritizes the desktop batch workstation first, then the prompt and intake production loop, then list/asset/account support surfaces.

## Controller Polish Mapping Lock

Source planning doc:

```text
docs/codex-controller-polish-tasks.md
```

The Controller polish pack is accepted as a UI critique and micro-task source, but it must be adapted to the actual repo before runtime coding.

Actual repo mapping as of 2026-05-18:

- `StatusBadge` already exposes optional `size`, `variant`, and `muted` props in `src/components/operator/status-badge.tsx`; runtime work may only complete usage/CSS verification and targeted polish.
- `/controller` uses `src/app/controller/controller-workflow-stepper.tsx`, not a local `ControllerWorkflowRail` component in `page.tsx`.
- `/controller` currently uses `src/app/controller/controller-manifest-popover.tsx` for manifest editing/export, not the earlier inline `<details>` panel assumed by TASK 08.
- `/controller` remains desktop-only; mobile must continue to redirect to `/products/new` after any placeholder fallback.
- `docs/codex-controller-polish-tasks.md` mentions `pnpm`; this repo's required verification remains `npm run lint`, `npm run typecheck`, and `npm run build`.

Controller polish runtime tasks must preserve the current data/action contracts:

- no Supabase query, server action, form field name, route, status enum, manifest schema, or helper callback changes.
- no new dependencies.
- no mobile Flow queue surface.
- no browser automation or Google Flow auto-submit.
- no Chrome profile path or helper local path storage.
- no hardcoded font sizes, font weights, line heights, colors, RGB values, hex values, or route-local palette literals in component code.

Adapted Controller polish execution order:

1. `CTRL-POLISH-01` - StatusBadge visual weight completion and verification.
2. `CTRL-POLISH-02` - Controller stepper/header hierarchy and duplicate CSS consolidation.
3. `CTRL-POLISH-03` - Batch card visual zones, action hierarchy, and action icon semantics.
4. `CTRL-POLISH-04` - Flow account form responsiveness and batch selection state feedback.
5. `CTRL-POLISH-05` - Controller loading skeleton, mobile fallback, and manifest popover polish.

The original 10-task pack may be used as implementation notes only after this mapping. If the task text conflicts with the actual repo components above, this mapping wins.

## Verification Rule

Every later UI polish task must run:

```bash
npm run lint
npm run typecheck
npm run build
```

Docs-only tasks may run `npm run typecheck` when explicitly scoped that way, but any CSS, React, route, layout, or component polish must run the full verification set.

## Lock Statement

UI shell rebrand work is presentation-only unless a later micro-task explicitly expands scope.

The goal is to make Banplex OS feel intentionally designed, professional, dense, calm, and production-grade while preserving all app flow, all data contracts, all route contracts, all form contracts, and all helper contracts.
