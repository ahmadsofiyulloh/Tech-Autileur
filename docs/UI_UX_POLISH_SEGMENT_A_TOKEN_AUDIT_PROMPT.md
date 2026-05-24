# UI/UX Polish Segment A Prompt - Token Audit

Copy this prompt into a new implementer session and send it as-is.

```text
You are implementing a locked UI/UX polish micro-task for Banplex OS.

Read these docs first:
1. docs/UI_UX_POLISH_SESSION_START.md
2. docs/UI_UX_POLISH_ONE_PAGER.md
3. docs/UI_UX_POLISH_QUICKSTART.md
4. docs/UI_UX_POLISH_PLAN.md
5. docs/UI_UX_POLISH_IMPLEMENTER_GUIDE.md
6. docs/PRD_SOURCE_OF_TRUTH.md
7. docs/ARCHITECTURE_LOCK.md
8. docs/MOBILE_REMOTE_CONTROL_LOCK.md
9. docs/MICRO_TASK_BACKLOG.md

Active task:
- Segment: Segment A: Token audit
- Goal: Verify typography, spacing, radius, shadow, and surface values are token-driven.
- Likely files: docs/UI_UX_POLISH_PLAN.md, src/app/globals.css, src/components/operator/section-card.tsx, src/components/ui/card.tsx, src/components/operator/loading-skeleton.tsx, src/components/operator/empty-state.tsx, src/components/operator/status-badge.tsx, src/components/operator/bottom-sheet.tsx, src/components/app-shell.tsx
- Out of scope: page redesign, component behavior changes, route changes, flow changes, schema changes, navigation changes, new product features, marketing hero layout, browser automation, auto upload TikTok/Shopee

Hard rules:
- Keep page title -> section title -> card title -> body -> meta/label.
- Keep the 8pt spacing rhythm.
- Keep mobile-first behavior.
- Keep loading, empty, and error states on every active surface.
- Keep bottom sheets and drawers safe-area aware.
- Do not change flow, schema, or navigation for polish work.
- Do not invent visual assumptions from empty space.
- Do not add new copy unless the lock docs already allow it.
- If a new visual token is needed, extend the token layer first.

Execution rules:
1. Work only inside Segment A.
2. Start by inspecting token usage and identify any hardcoded visual values.
3. Make the smallest valid change.
4. Prefer token-backed values over literals.
5. Do not widen scope to other surfaces unless the plan explicitly says so.
6. Stop immediately if the task would affect flow, schema, navigation, or unapproved copy.

Required output:
- segment name
- goal
- files changed
- scope completed
- out of scope
- verification results
- risks or assumptions

Before coding:
- Restate the segment and goal.
- List the exact files you expect to change.
- State what is out of scope.
- Confirm whether a new token is needed.
- Choose the smallest valid change.

Stop conditions:
- The task needs a new token and the token layer has not been extended.
- The task affects flow, schema, or navigation.
- The task requires unapproved copy.
- The scope starts expanding beyond the active segment.
```

## Notes
- This prompt is prefilled for immediate execution.
- It is intentionally narrow and does not ask the implementer to choose scope.
