# UI/UX Polish Implementer Prompt

Copy this prompt into a new implementer session and fill the brackets before sending.

---

You are implementing a locked UI/UX polish micro-task for Affiliate AI Content OS.

Start by reading these docs in order:

1. [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
2. [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
3. [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
4. [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
5. [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)
6. [PRD_SOURCE_OF_TRUTH.md](PRD_SOURCE_OF_TRUTH.md)
7. [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md)
8. [MOBILE_REMOTE_CONTROL_LOCK.md](MOBILE_REMOTE_CONTROL_LOCK.md)
9. [MICRO_TASK_BACKLOG.md](MICRO_TASK_BACKLOG.md)

## Active Task
- Segment: [ACTIVE_SEGMENT]
- Goal: [ACTIVE_GOAL]
- Likely files: [LIKELY_FILES]
- Out of scope: [OUT_OF_SCOPE]

## Hard Rules
- Keep `page title -> section title -> card title -> body -> meta/label`.
- Keep the 8pt spacing rhythm.
- Keep mobile-first behavior.
- Keep loading, empty, and error states on every active surface.
- Keep bottom sheets and drawers safe-area aware.
- Do not change flow, schema, or navigation for polish work.
- Do not invent visual assumptions from empty space.
- Do not add new copy unless the lock docs already allow it.
- If a new visual token is needed, extend the token layer first.

## Execution Rules
1. Work only inside the active segment.
2. Make the smallest valid change.
3. Prefer token-backed values over literals.
4. Do not widen scope to other surfaces unless the plan explicitly says so.
5. Stop immediately if the task would affect flow, schema, navigation, or unapproved copy.

## Required Output
Return results in this format:

- segment name
- goal
- files changed
- scope completed
- out of scope
- verification results
- risks or assumptions

## Initial Work Instruction
Before coding, restate the segment and list the exact files you expect to change.

If anything is ambiguous, resolve it from the docs first. Do not guess.

## Stop Conditions
Stop and report instead of coding if:

- the task needs a new token and the token layer has not been extended
- the task affects flow, schema, or navigation
- the task requires unapproved copy
- the scope starts expanding beyond the active segment

---

Replace the bracketed values and send this as the session prompt:

```text
You are implementing a locked UI/UX polish micro-task for Affiliate AI Content OS.

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
- Segment: [ACTIVE_SEGMENT]
- Goal: [ACTIVE_GOAL]
- Likely files: [LIKELY_FILES]
- Out of scope: [OUT_OF_SCOPE]

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
1. Work only inside the active segment.
2. Make the smallest valid change.
3. Prefer token-backed values over literals.
4. Do not widen scope to other surfaces unless the plan explicitly says so.
5. Stop immediately if the task would affect flow, schema, navigation, or unapproved copy.

Required output:
- segment name
- goal
- files changed
- scope completed
- out of scope
- verification results
- risks or assumptions

Before coding, restate the segment and list the exact files you expect to change.
If anything is ambiguous, resolve it from the docs first. Do not guess.
```
