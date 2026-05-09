# UI/UX Polish Session Start

## Purpose
This page tells an implementer exactly what to do at the start of a UI/UX polish session.

The goal is to remove guesswork before any code change.

## Required Reading Order
Open these in order before touching code:

1. [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
2. [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
3. [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
4. [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
5. [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)
6. [PRD_SOURCE_OF_TRUTH.md](PRD_SOURCE_OF_TRUTH.md)
7. [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md)
8. [MOBILE_REMOTE_CONTROL_LOCK.md](MOBILE_REMOTE_CONTROL_LOCK.md)
9. [MICRO_TASK_BACKLOG.md](MICRO_TASK_BACKLOG.md)

## Session Start Checklist

1. Identify the active segment from the canonical plan.
2. Restate the goal in one sentence.
3. List the exact files that are likely to change.
4. State what is out of scope.
5. Confirm whether a new visual token is needed.
6. Confirm whether the change can be done without touching flow, schema, or navigation.
7. Choose the smallest valid change.

## What To Do Next

- If the task is clearly inside one segment, start from the smallest file first.
- If the task needs a new token, extend the token layer before editing components.
- If the task would change flow, schema, or navigation, stop and re-scope.
- If the task requires new copy, stop and verify it is already allowed.

## Working Contract

- Keep hierarchy: `page title -> section title -> card title -> body -> meta/label`.
- Keep spacing on the 8pt rhythm.
- Keep mobile-first behavior as the default.
- Keep loading, empty, and error states on every active surface.
- Keep bottom sheets and drawers safe-area aware.
- Keep changes limited to the active segment only.

## Required Output
Every session update must include:

- active segment
- goal
- files likely to change
- out of scope
- decision on tokens
- next safe action

If any of these cannot be stated, the session is not ready to code yet.

## Stop Conditions
Stop immediately if:

- the change needs a new token and the token layer has not been extended
- the change affects flow, schema, or navigation
- the change requires unapproved copy
- the change starts expanding beyond the active segment
