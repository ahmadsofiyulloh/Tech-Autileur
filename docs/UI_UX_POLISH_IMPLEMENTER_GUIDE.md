# UI/UX Polish Implementer Guide

## Purpose
This guide exists so any implementer can continue UI/UX polish work without reading prior chat context. It translates the locked polish plan into a fixed execution contract.

If this guide and the lock docs conflict, the lock docs win. If this guide and the implementation plan conflict, the implementation plan wins. If any task requires a new product decision, stop and update the plan before coding.

## Locked References
Read these before making any UI change:

- [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
- [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
- [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
- [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
- [PRD_SOURCE_OF_TRUTH.md](PRD_SOURCE_OF_TRUTH.md)
- [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md)
- [MOBILE_REMOTE_CONTROL_LOCK.md](MOBILE_REMOTE_CONTROL_LOCK.md)
- [MICRO_TASK_BACKLOG.md](MICRO_TASK_BACKLOG.md)
- [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)

## Canonical Plan Order
These are the only approved UI/UX polish segments in the current plan.

1. `Segment A: Token audit`
2. `Segment B: Typography pass`
3. `Segment C: Section spacing pass`
4. `Segment D: Card anatomy pass`
5. `Segment E: State surfaces pass`
6. `Segment F: Bottom sheet polish`
7. `Segment G: Shell spacing polish`

Do not reorder these segments unless the plan document is updated first.

## Non-Negotiable Rules

- Keep the hierarchy: `page title -> section title -> card title -> body -> meta/label`.
- Keep spacing on the 8pt rhythm.
- Keep mobile-first behavior as the default visual target.
- Keep loading, empty, and error states on every active surface.
- Keep bottom sheets and drawers safe-area aware.
- Keep all polished surfaces visually consistent with each other.
- Keep changes limited to the smallest valid scope for the active segment.
- Never use polish work to introduce new product features, navigation changes, or schema changes.

## Anti-Assumption Rules

- Do not invent new visual tokens unless the token layer is explicitly being extended.
- Do not infer new layout patterns from empty space.
- Do not widen scope because a screen looks unfinished.
- Do not add helper copy, marketing copy, or explanatory text unless the lock docs already allow it.
- Do not reshape a component for one route if it will break consistency on other routes.
- Do not change business logic when the task is only about visual polish.

## Segment Contracts

### Segment A: Token audit
Goal: verify typography, spacing, radius, shadow, and surface values are token-driven.

Allowed work:
- inspect token usage
- identify hardcoded visual values
- extend tokens only if a missing value is truly required

Not allowed:
- page redesign
- component behavior changes
- route changes

Output:
- list of token issues found
- list of files that still use literals
- decision on whether a token extension is needed

### Segment B: Typography pass
Goal: align page, section, card, body, and meta text hierarchy.

Allowed work:
- normalize title levels
- reduce competing emphasis
- tighten typography to the locked hierarchy

Not allowed:
- changing content meaning
- adding new copy
- changing the screen structure

Output:
- files changed
- hierarchy changes made
- anything intentionally left untouched

### Segment C: Section spacing pass
Goal: make section wrappers feel like one system.

Allowed work:
- unify padding and gaps
- stabilize header/body spacing
- keep section density consistent across routes

Not allowed:
- changing section content
- adding new blocks
- changing navigation or flow

Output:
- section wrapper files updated
- spacing values standardized
- any exceptions documented

### Segment D: Card anatomy pass
Goal: make every operational card share one anatomy.

Allowed work:
- normalize border, radius, shadow, and padding
- align title/meta/body/action order
- make cards behave consistently on mobile and desktop

Not allowed:
- inventing a new card style for a single surface
- changing card behavior beyond visual polish

Output:
- card component changes
- list of surfaces validated mentally or via preview

### Segment E: State surfaces pass
Goal: make loading, empty, error, badge, and status surfaces feel like one family.

Allowed work:
- normalize skeleton shapes
- adjust empty states
- align badge/status scale and tone

Not allowed:
- introducing new states without a locked need
- making status visually louder than titles

Output:
- state components updated
- state hierarchy notes

### Segment F: Bottom sheet polish
Goal: keep bottom sheets and drawers native-feel and safe-area aware.

Allowed work:
- tune sheet padding, radius, and handle spacing
- verify safe-area behavior
- keep sheet content readable and compact

Not allowed:
- adding new sheet interaction types
- changing sheet purpose

Output:
- bottom sheet changes
- any safe-area adjustments

### Segment G: Shell spacing polish
Goal: keep topbar, content offset, and bottom nav spacing from disturbing page hierarchy.

Allowed work:
- refine shell offsets and gaps
- keep navigation spacing stable
- ensure page titles still read first

Not allowed:
- changing the nav structure
- adding new shell affordances

Output:
- shell changes
- routes visually checked

## Standard Execution Workflow

1. Read the lock docs and this guide.
2. Identify the active segment.
3. List the exact files likely to change.
4. Confirm what is out of scope for the segment.
5. Make the smallest valid change.
6. Verify the result with the relevant checks.
7. Report changed files, what stayed untouched, and any risk.

## Required Output Format For Every Task
Every implementation result must include:

- segment name
- goal
- files changed
- scope completed
- out of scope
- verification results
- risks or assumptions, if any

If a task cannot meet this format, the task is not done.

## Decision Tree

- If the change needs a new visual token, extend tokens first.
- If the change affects only hierarchy or spacing, keep it inside the current component or wrapper.
- If the change would alter flow, schema, or navigation, stop and re-scope.
- If the change requires copy that is not already approved, stop and re-scope.
- If the change feels "nice to have" but does not serve the current segment, leave it out.

## Consistency Rules

- Prefer the same visual treatment for the same type of surface.
- Prefer the smallest possible diff that preserves the locked hierarchy.
- Prefer stable tokens over inline styling.
- Prefer consistency across routes over perfection in one route.
- Prefer implementation that another engineer can continue without extra explanation.

## Handoff Requirement
Before closing any UI/UX polish task, the implementer must ensure:

- the segment is named explicitly
- the changed files are listed
- the untouched scope is listed
- the verification result is stated honestly
- the next safe step is obvious

## Living Document Rule
If a new polish micro-task is approved, add it to the plan first, then update this guide only if the execution contract changes.
